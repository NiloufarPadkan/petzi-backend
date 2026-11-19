import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Paginated,
  PaginationQueryDto,
  paginated,
} from '../../common/dto/pagination-query.dto';
import { MessageSenderRole } from '../../common/enums/admin-panel.enums';
import { User } from '../users/entities/user.entity';
import { QueryConversationsDto } from './dto/message.dto';
import { ChatMessage } from './entities/chat-message.entity';
import { Conversation } from './entities/conversation.entity';

export interface ConversationView {
  id: string;
  user: {
    id: string;
    fullName: string | null;
    phoneNumber: string;
    role: string;
    profilePictureUrl: string | null;
  };
  lastMessageAt: Date | null;
  lastMessagePreview: string | null;
  unreadCount: number;
}

const PREVIEW_LENGTH = 120;

@Injectable()
export class MessagesService {
  constructor(
    @InjectRepository(Conversation)
    private readonly conversationsRepository: Repository<Conversation>,
    @InjectRepository(ChatMessage)
    private readonly messagesRepository: Repository<ChatMessage>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findConversations(
    query: QueryConversationsDto,
  ): Promise<Paginated<ConversationView>> {
    const qb = this.conversationsRepository
      .createQueryBuilder('c')
      .innerJoinAndSelect('c.user', 'user')
      .where('user.deletedAt IS NULL');
    if (query.search) {
      qb.andWhere('(user.fullName ILIKE :s OR user.phoneNumber ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.role) qb.andWhere('user.role = :role', { role: query.role });
    if (query.unreadOnly) qb.andWhere('c.unreadByAdmin > 0');

    const [conversations, total] = await qb
      .orderBy('c.lastMessageAt', 'DESC', 'NULLS LAST')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(
      conversations.map((c) => this.toView(c)),
      total,
      query,
    );
  }

  /** Newest messages first; opening the first page marks it as read. */
  async findMessages(
    conversationId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ChatMessage>> {
    const conversation = await this.getConversationOrThrow(conversationId);
    const [items, total] = await this.messagesRepository.findAndCount({
      where: { conversationId },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    if (query.page === 1 && conversation.unreadByAdmin > 0) {
      await this.conversationsRepository.update(conversationId, {
        unreadByAdmin: 0,
      });
    }
    return paginated(items, total, query);
  }

  async sendAsAdmin(
    conversationId: string,
    body: string,
    adminId: string,
  ): Promise<ChatMessage> {
    await this.getConversationOrThrow(conversationId);
    return this.addMessage(
      conversationId,
      MessageSenderRole.ADMIN,
      adminId,
      body,
    );
  }

  async startConversation(
    userId: string,
    body: string,
    adminId: string,
  ): Promise<ChatMessage> {
    const user = await this.usersRepository.findOne({ where: { id: userId } });
    if (!user) throw new NotFoundException('کاربر یافت نشد');
    const conversation = await this.getOrCreateConversation(userId);
    return this.addMessage(
      conversation.id,
      MessageSenderRole.ADMIN,
      adminId,
      body,
    );
  }

  async sendAsUser(userId: string, body: string): Promise<ChatMessage> {
    const conversation = await this.getOrCreateConversation(userId);
    return this.addMessage(
      conversation.id,
      MessageSenderRole.USER,
      userId,
      body,
    );
  }

  async findMine(
    userId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ChatMessage>> {
    const conversation = await this.conversationsRepository.findOne({
      where: { userId },
    });
    if (!conversation) return paginated([], 0, query);
    const [items, total] = await this.messagesRepository.findAndCount({
      where: { conversationId: conversation.id },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginated(items, total, query);
  }

  async removeMessage(
    conversationId: string,
    messageId: string,
  ): Promise<void> {
    await this.getConversationOrThrow(conversationId);
    const message = await this.messagesRepository.findOne({
      where: { id: messageId, conversationId },
    });
    if (!message) throw new NotFoundException('پیام یافت نشد');
    await this.messagesRepository.remove(message);
    await this.refreshLastMessage(conversationId);
  }

  async removeConversation(conversationId: string): Promise<void> {
    await this.conversationsRepository.remove(
      await this.getConversationOrThrow(conversationId),
    );
  }

  private async addMessage(
    conversationId: string,
    senderRole: MessageSenderRole,
    senderId: string,
    body: string,
  ): Promise<ChatMessage> {
    return this.dataSource.transaction(async (manager) => {
      const message = await manager.save(
        manager.create(ChatMessage, {
          conversationId,
          senderRole,
          senderId,
          body,
        }),
      );
      const update = manager
        .createQueryBuilder()
        .update(Conversation)
        .set({
          lastMessageAt: message.createdAt,
          lastMessagePreview: body.slice(0, PREVIEW_LENGTH),
          ...(senderRole === MessageSenderRole.USER
            ? { unreadByAdmin: () => '"unreadByAdmin" + 1' }
            : {}),
        })
        .where('id = :conversationId', { conversationId });
      await update.execute();
      return message;
    });
  }

  private async refreshLastMessage(conversationId: string): Promise<void> {
    const last = await this.messagesRepository.findOne({
      where: { conversationId },
      order: { createdAt: 'DESC' },
    });
    await this.conversationsRepository.update(conversationId, {
      lastMessageAt: last?.createdAt ?? null,
      lastMessagePreview: last?.body.slice(0, PREVIEW_LENGTH) ?? null,
    });
  }

  private async getOrCreateConversation(userId: string): Promise<Conversation> {
    const existing = await this.conversationsRepository.findOne({
      where: { userId },
    });
    if (existing) return existing;
    await this.conversationsRepository
      .createQueryBuilder()
      .insert()
      .values({ userId })
      .orIgnore()
      .execute();
    return this.conversationsRepository.findOneOrFail({ where: { userId } });
  }

  private async getConversationOrThrow(id: string): Promise<Conversation> {
    const conversation = await this.conversationsRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!conversation) throw new NotFoundException('گفتگو یافت نشد');
    return conversation;
  }

  private toView(conversation: Conversation): ConversationView {
    const { user } = conversation;
    return {
      id: conversation.id,
      user: {
        id: user.id,
        fullName: user.fullName,
        phoneNumber: user.phoneNumber,
        role: user.role,
        profilePictureUrl: user.profilePictureUrl,
      },
      lastMessageAt: conversation.lastMessageAt,
      lastMessagePreview: conversation.lastMessagePreview,
      unreadCount: conversation.unreadByAdmin,
    };
  }
}
