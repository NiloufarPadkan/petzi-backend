import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import {
  TEHRAN_TIME_ZONE,
  tehranDayRange,
  tehranToday,
} from '../../common/utils/tehran-time';
import { RescheduleReservationDto } from '../reservations/dto/reservation.dto';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationsService } from '../reservations/reservations.service';
import type { ClinicContext } from './clinic-panel.guard';
import {
  CalendarQueryDto,
  PanelCreateReservationDto,
  PanelQueryReservationsDto,
  PanelUpdateReservationDto,
} from './dto/panel-reservations.dto';
import { ClinicMember } from './entities/clinic-member.entity';

const MAX_CALENDAR_DAYS = 62;

/** Clinic-scoped wrapper around the shared reservations service. */
@Injectable()
export class ClinicReservationsService {
  constructor(
    private readonly reservationsService: ReservationsService,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(ClinicMember)
    private readonly membersRepository: Repository<ClinicMember>,
  ) {}

  list(ctx: ClinicContext, query: PanelQueryReservationsDto) {
    const search: Parameters<ReservationsService['findAll']>[0] = {
      page: query.page,
      limit: query.limit,
      search: query.search,
      status: query.status,
      vetId: query.vetId,
      clinicId: ctx.clinicId,
      sort: query.sort === 'oldest' ? 'asc' : 'desc',
    };

    if (query.scope === 'today') {
      const { start, end } = tehranDayRange(tehranToday());
      search.fromAt = start;
      search.toAt = end;
      search.sort = 'asc';
    } else {
      if (query.from)
        search.fromAt = tehranDayRange(query.from.slice(0, 10)).start;
      if (query.to) search.toAt = tehranDayRange(query.to.slice(0, 10)).end;
    }
    return this.reservationsService.findAll(search);
  }

  /** Reservation counts per Tehran calendar day for the calendar view. */
  async calendar(ctx: ClinicContext, query: CalendarQueryDto) {
    const start = tehranDayRange(query.from.slice(0, 10)).start;
    const end = tehranDayRange(query.to.slice(0, 10)).end;
    if (end <= start) throw new BadRequestException('بازه تاریخ نامعتبر است');
    if ((end.getTime() - start.getTime()) / 86_400_000 > MAX_CALENDAR_DAYS) {
      throw new BadRequestException(
        `بازه نباید بیشتر از ${MAX_CALENDAR_DAYS} روز باشد`,
      );
    }

    const rows = await this.reservationsRepository
      .createQueryBuilder('r')
      .select(
        `to_char(r.scheduledAt AT TIME ZONE '${TEHRAN_TIME_ZONE}', 'YYYY-MM-DD')`,
        'day',
      )
      .addSelect('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.clinicId = :clinicId', { clinicId: ctx.clinicId })
      .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', {
        start,
        end,
      })
      .groupBy('day')
      .addGroupBy('r.status')
      .orderBy('day', 'ASC')
      .getRawMany<{ day: string; status: ReservationStatus; count: string }>();

    const days = new Map<
      string,
      { date: string; total: number; byStatus: Record<string, number> }
    >();
    for (const row of rows) {
      const entry = days.get(row.day) ?? {
        date: row.day,
        total: 0,
        byStatus: {},
      };
      entry.total += Number(row.count);
      entry.byStatus[row.status] = Number(row.count);
      days.set(row.day, entry);
    }
    return { today: tehranToday(), days: [...days.values()] };
  }

  async findOne(ctx: ClinicContext, id: string) {
    await this.assertOwn(ctx, id);
    return this.reservationsService.findOne(id);
  }

  async create(ctx: ClinicContext, dto: PanelCreateReservationDto) {
    await this.assertClinicVet(ctx, dto.vetId);
    return this.reservationsService.create(
      {
        ...dto,
        clinicId: ctx.clinicId,
        status: dto.status ?? ReservationStatus.CONFIRMED,
      },
      ctx.userId,
    );
  }

  async update(ctx: ClinicContext, id: string, dto: PanelUpdateReservationDto) {
    await this.assertOwn(ctx, id);
    await this.assertClinicVet(ctx, dto.vetId);
    return this.reservationsService.update(id, dto, ctx.userId);
  }

  async reschedule(
    ctx: ClinicContext,
    id: string,
    dto: RescheduleReservationDto,
  ) {
    await this.assertOwn(ctx, id);
    return this.reservationsService.reschedule(id, dto, ctx.userId);
  }

  async changeStatus(
    ctx: ClinicContext,
    id: string,
    status: ReservationStatus,
  ) {
    await this.assertOwn(ctx, id);
    return this.reservationsService.changeStatus(id, status, ctx.userId);
  }

  /** Rejecting a pending request; same effect as a cancel, with the reason. */
  async decline(ctx: ClinicContext, id: string, reason: string) {
    const reservation = await this.assertOwn(ctx, id);
    if (reservation.status !== ReservationStatus.PENDING) {
      throw new BadRequestException(
        'فقط درخواست‌های در انتظار قابل رد کردن هستند',
      );
    }
    return this.reservationsService.cancel(id, reason, ctx.userId);
  }

  async cancel(ctx: ClinicContext, id: string, reason: string) {
    await this.assertOwn(ctx, id);
    return this.reservationsService.cancel(id, reason, ctx.userId);
  }

  async remove(ctx: ClinicContext, id: string) {
    await this.assertOwn(ctx, id);
    await this.reservationsService.remove(id);
  }

  async addNote(ctx: ClinicContext, id: string, text: string) {
    await this.assertOwn(ctx, id);
    return this.reservationsService.addNote(id, text, ctx.userId);
  }

  async removeNote(ctx: ClinicContext, id: string, noteId: string) {
    await this.assertOwn(ctx, id);
    await this.reservationsService.removeNote(id, noteId);
  }

  private async assertOwn(
    ctx: ClinicContext,
    id: string,
  ): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id, clinicId: ctx.clinicId },
    });
    if (!reservation) throw new NotFoundException('رزرو یافت نشد');
    return reservation;
  }

  /** A reservation can only be assigned to an active vet of this clinic. */
  private async assertClinicVet(ctx: ClinicContext, vetId?: string | null) {
    if (!vetId) return;
    const isMember = await this.membersRepository.exists({
      where: { clinicId: ctx.clinicId, userId: vetId, isActive: true },
    });
    if (!isMember) {
      throw new BadRequestException('دامپزشک انتخاب‌شده عضو این کلینیک نیست');
    }
  }
}
