import { Injectable, NotFoundException } from '@nestjs/common';
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
import { SupportTicket } from './entities/support-ticket.entity';

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
  ): Promise<TicketView> {
    const ticket = await this.ticketsRepository.save(
      this.ticketsRepository.create({
        ...dto,
        category: dto.category || 'general',
        creatorId,
      }),
    );
    return this.findTicket(ticket.id);
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
    await this.ticketsRepository.remove(await this.getTicketOrThrow(id));
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
