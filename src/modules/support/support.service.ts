import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginated } from '../../common/dto/pagination-query.dto';
import { TicketStatus } from '../../common/enums/admin-panel.enums';
import {
  CreateFaqDto,
  CreateTicketDto,
  QueryFaqDto,
  QueryTicketsDto,
  UpdateFaqDto,
  UpdateTicketDto,
} from './dto/support.dto';
import { FaqItem } from './entities/faq-item.entity';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import {
  SupportTicket,
  TicketAttachment,
} from './entities/support-ticket.entity';
import { MAX_TICKET_ATTACHMENTS } from './support.constants';

export interface TicketView {
  id: string;
  number: number;
  code: string;
  subject: string;
  category: string;
  description: string;
  priority: string;
  status: string;
  adminResponse: string | null;
  attachments: TicketAttachment[];
  resolvedAt: Date | null;
  creator: {
    id: string;
    fullName: string | null;
    phoneNumber: string;
    role: string;
  } | null;
  createdAt: Date;
  updatedAt: Date;
}

@Injectable()
export class SupportService {
  constructor(
    @InjectRepository(SupportTicket)
    private readonly ticketsRepository: Repository<SupportTicket>,
    @InjectRepository(FaqItem)
    private readonly faqRepository: Repository<FaqItem>,
  ) {}

  // ---- Tickets ----

  async findTickets(query: QueryTicketsDto): Promise<Paginated<TicketView>> {
    const qb = this.ticketsRepository
      .createQueryBuilder('ticket')
      .leftJoinAndSelect('ticket.creator', 'creator');

    if (query.search) {
      qb.andWhere(
        `(ticket.subject ILIKE :search OR creator.fullName ILIKE :search OR creator.phoneNumber ILIKE :search OR CAST(ticket.number AS text) = :exact)`,
        {
          search: `%${query.search}%`,
          exact: query.search.replace(/^TK-/i, ''),
        },
      );
    }
    if (query.status) {
      qb.andWhere('ticket.status = :status', { status: query.status });
    }
    if (query.priority) {
      qb.andWhere('ticket.priority = :priority', { priority: query.priority });
    }
    if (query.category) {
      qb.andWhere('ticket.category = :category', { category: query.category });
    }
    if (query.from)
      qb.andWhere('ticket.createdAt >= :from', { from: query.from });
    if (query.to) {
      qb.andWhere('ticket.createdAt < :to::date + 1', { to: query.to });
    }

    const [tickets, total] = await qb
      .orderBy('ticket.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(
      tickets.map((ticket) => this.toView(ticket)),
      total,
      query,
    );
  }

  async getTicketStats(): Promise<Record<TicketStatus | 'total', number>> {
    const rows = await this.ticketsRepository
      .createQueryBuilder('ticket')
      .select('ticket.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('ticket.status')
      .getRawMany<{ status: TicketStatus; count: string }>();
    const stats = {
      total: 0,
      [TicketStatus.OPEN]: 0,
      [TicketStatus.IN_PROGRESS]: 0,
      [TicketStatus.RESOLVED]: 0,
      [TicketStatus.CLOSED]: 0,
    };
    for (const row of rows) {
      stats[row.status] = Number(row.count);
      stats.total += Number(row.count);
    }
    return stats;
  }

  async findTicket(id: string): Promise<TicketView> {
    return this.toView(await this.getTicketOrThrow(id));
  }

  async createTicket(
    dto: CreateTicketDto,
    creatorId: string,
    attachments: TicketAttachment[] = [],
  ): Promise<TicketView> {
    const ticket = await this.ticketsRepository.save(
      this.ticketsRepository.create({
        ...dto,
        category: dto.category || 'general',
        creatorId,
        attachments,
      }),
    );
    return this.findTicket(ticket.id);
  }

  /** One of the signed-in user's own tickets. */
  async findMyTicket(creatorId: string, id: string): Promise<TicketView> {
    return this.toView(await this.getOwnTicketOrThrow(creatorId, id));
  }

  /** Adds images to the user's own open ticket (at most 5 in total). */
  async addAttachments(
    creatorId: string,
    id: string,
    attachments: TicketAttachment[],
  ): Promise<TicketView> {
    const ticket = await this.getOwnTicketOrThrow(creatorId, id);
    if (
      ticket.status === TicketStatus.RESOLVED ||
      ticket.status === TicketStatus.CLOSED
    ) {
      throw new BadRequestException('این تیکت بسته شده و پیوست جدید نمی‌پذیرد');
    }
    const current = ticket.attachments ?? [];
    if (current.length + attachments.length > MAX_TICKET_ATTACHMENTS) {
      throw new BadRequestException(
        `هر تیکت حداکثر ${MAX_TICKET_ATTACHMENTS} پیوست دارد`,
      );
    }
    await this.ticketsRepository.update(id, {
      attachments: [...current, ...attachments],
    });
    return this.findMyTicket(creatorId, id);
  }

  async removeAttachment(
    creatorId: string,
    id: string,
    index: number,
  ): Promise<TicketView> {
    const ticket = await this.getOwnTicketOrThrow(creatorId, id);
    const current = ticket.attachments ?? [];
    const target = current[index];
    if (!target) throw new NotFoundException('پیوست یافت نشد');
    await this.ticketsRepository.update(id, {
      attachments: current.filter((_, i) => i !== index),
    });
    await removeUploadUrls([target.url]);
    return this.findMyTicket(creatorId, id);
  }

  async findMyTickets(creatorId: string): Promise<TicketView[]> {
    const tickets = await this.ticketsRepository.find({
      where: { creatorId },
      relations: { creator: true },
      order: { createdAt: 'DESC' },
    });
    return tickets.map((ticket) => this.toView(ticket));
  }

  async updateTicket(id: string, dto: UpdateTicketDto): Promise<TicketView> {
    const ticket = await this.getTicketOrThrow(id);
    Object.assign(ticket, dto);
    if (dto.status) {
      ticket.resolvedAt =
        dto.status === TicketStatus.RESOLVED ||
        dto.status === TicketStatus.CLOSED
          ? (ticket.resolvedAt ?? new Date())
          : null;
    }
    await this.ticketsRepository.save(ticket);
    return this.findTicket(id);
  }

  async removeTicket(id: string): Promise<void> {
    const ticket = await this.getTicketOrThrow(id);
    await this.ticketsRepository.remove(ticket);
    const urls = (ticket.attachments ?? []).map((a) => a.url);
    if (urls.length > 0) await removeUploadUrls(urls);
  }

  // ---- FAQ ----

  findFaq(query: QueryFaqDto): Promise<FaqItem[]> {
    const qb = this.faqRepository.createQueryBuilder('faq');
    if (query.search) {
      qb.andWhere('(faq.question ILIKE :s OR faq.answer ILIKE :s)', {
        s: `%${query.search}%`,
      });
    }
    if (query.isPublished !== undefined) {
      qb.andWhere('faq.isPublished = :p', { p: query.isPublished });
    }
    return qb
      .orderBy('faq.sortOrder', 'ASC')
      .addOrderBy('faq.createdAt', 'ASC')
      .getMany();
  }

  async createFaq(dto: CreateFaqDto): Promise<FaqItem> {
    return this.faqRepository.save(this.faqRepository.create(dto));
  }

  async updateFaq(id: string, dto: UpdateFaqDto): Promise<FaqItem> {
    const item = await this.getFaqOrThrow(id);
    return this.faqRepository.save(Object.assign(item, dto));
  }

  async removeFaq(id: string): Promise<void> {
    await this.faqRepository.remove(await this.getFaqOrThrow(id));
  }

  // ---- helpers ----

  private async getOwnTicketOrThrow(
    creatorId: string,
    id: string,
  ): Promise<SupportTicket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id, creatorId },
      relations: { creator: true },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    return ticket;
  }

  private async getTicketOrThrow(id: string): Promise<SupportTicket> {
    const ticket = await this.ticketsRepository.findOne({
      where: { id },
      relations: { creator: true },
    });
    if (!ticket) throw new NotFoundException('تیکت یافت نشد');
    return ticket;
  }

  private async getFaqOrThrow(id: string): Promise<FaqItem> {
    const item = await this.faqRepository.findOne({ where: { id } });
    if (!item) throw new NotFoundException('سوال یافت نشد');
    return item;
  }

  private toView(ticket: SupportTicket): TicketView {
    return {
      id: ticket.id,
      number: ticket.number,
      code: `TK-${ticket.number}`,
      subject: ticket.subject,
      category: ticket.category,
      description: ticket.description,
      priority: ticket.priority,
      status: ticket.status,
      adminResponse: ticket.adminResponse,
      attachments: ticket.attachments ?? [],
      resolvedAt: ticket.resolvedAt,
      creator: ticket.creator
        ? {
            id: ticket.creator.id,
            fullName: ticket.creator.fullName,
            phoneNumber: ticket.creator.phoneNumber,
            role: ticket.creator.role,
          }
        : null,
      createdAt: ticket.createdAt,
      updatedAt: ticket.updatedAt,
    };
  }
}
