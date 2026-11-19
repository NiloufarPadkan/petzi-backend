import { BadRequestException, Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import {
  PaymentStatus,
  ReservationStatus,
} from '../../common/enums/admin-panel.enums';
import {
  TEHRAN_TIME_ZONE,
  addDays,
  tehranDayRange,
  tehranToday,
} from '../../common/utils/tehran-time';
import { Payment } from '../payments/entities/payment.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ClinicPermission } from './clinic-panel.constants';
import type { ClinicContext } from './clinic-panel.guard';
import { DashboardQueryDto, ReportRangeDto } from './dto/reports.dto';

const MAX_REPORT_DAYS = 366;
const PAID_STATUSES = [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED];
const DAILY_BUCKET_MAX_DAYS = 62;

const percentChange = (current: number, previous: number): number | null =>
  previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

/** `to_char` over the Tehran calendar for a column, e.g. 'r.scheduledAt'. */
const tehranDay = (column: string, format = 'YYYY-MM-DD') =>
  `to_char(${column} AT TIME ZONE '${TEHRAN_TIME_ZONE}', '${format}')`;

interface Range {
  from: string;
  to: string;
  start: Date;
  /** Exclusive end. */
  end: Date;
  days: number;
}

@Injectable()
export class ClinicAnalyticsService {
  constructor(private readonly dataSource: DataSource) {}

  // ---- dashboard ----

  async dashboard(ctx: ClinicContext, query: DashboardQueryDto) {
    const today = tehranToday();
    const days = Number.parseInt(query.range, 10);
    const range = this.toRange(addDays(today, -(days - 1)), today);
    const canSeeReservations = ctx.permissions.has(
      ClinicPermission.RESERVATIONS_VIEW,
    );
    const canSeeFinance = ctx.permissions.has(ClinicPermission.FINANCE_VIEW);

    const [overview, reservationsSection, financial] = await Promise.all([
      canSeeReservations ? this.todayOverview(ctx.clinicId, today) : null,
      canSeeReservations ? this.reservationCharts(ctx.clinicId, range) : null,
      canSeeFinance ? this.revenueSeries(ctx.clinicId, range) : null,
    ]);

    return {
      today,
      range: query.range,
      overview,
      needsAction: canSeeReservations
        ? await this.needsAction(ctx.clinicId)
        : null,
      schedule: canSeeReservations
        ? await this.todaySchedule(ctx.clinicId, today)
        : null,
      financial,
      reservations: reservationsSection,
    };
  }

  private async todayOverview(clinicId: string, today: string) {
    const count = async (ymd: string) => {
      const { start, end } = tehranDayRange(ymd);
      const rows = await this.dataSource
        .getRepository(Reservation)
        .createQueryBuilder('r')
        .select('r.status', 'status')
        .addSelect('COUNT(*)', 'count')
        .where('r.clinicId = :clinicId', { clinicId })
        .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', {
          start,
          end,
        })
        .groupBy('r.status')
        .getRawMany<{ status: ReservationStatus; count: string }>();
      const byStatus = this.emptyStatusCounts();
      let total = 0;
      for (const row of rows) {
        byStatus[row.status] = Number(row.count);
        if (row.status !== ReservationStatus.CANCELLED)
          total += Number(row.count);
      }
      return { total, byStatus };
    };
    const [now, before] = await Promise.all([
      count(today),
      count(addDays(today, -1)),
    ]);
    return {
      total: now.total,
      byStatus: now.byStatus,
      changeVsYesterdayPercent: percentChange(now.total, before.total),
    };
  }

  private async needsAction(clinicId: string) {
    const repo = this.dataSource.getRepository(Reservation);
    const [pendingCount, pending] = await Promise.all([
      repo.count({ where: { clinicId, status: ReservationStatus.PENDING } }),
      repo.find({
        where: { clinicId, status: ReservationStatus.PENDING },
        relations: { owner: true, pet: true },
        order: { scheduledAt: 'ASC' },
        take: 5,
      }),
    ]);
    return {
      pendingReservations: pendingCount,
      pending: pending.map((r) => this.scheduleItem(r)),
    };
  }

  private async todaySchedule(clinicId: string, today: string) {
    const { start, end } = tehranDayRange(today);
    const reservations = await this.dataSource
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.owner', 'owner')
      .leftJoinAndSelect('r.pet', 'pet')
      .leftJoinAndSelect('r.vet', 'vet')
      .where('r.clinicId = :clinicId', { clinicId })
      .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', {
        start,
        end,
      })
      .andWhere('r.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      })
      .orderBy('r.scheduledAt', 'ASC')
      .getMany();
    return reservations.map((r) => this.scheduleItem(r));
  }

  private scheduleItem(r: Reservation) {
    return {
      id: r.id,
      code: `BK-${r.number}`,
      status: r.status,
      serviceName: r.serviceName,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      price: r.price,
      pet: r.pet ? { id: r.pet.id, name: r.pet.name } : null,
      owner: r.owner
        ? {
            id: r.owner.id,
            fullName: r.owner.fullName,
            phoneNumber: r.owner.phoneNumber,
          }
        : null,
      vet: r.vet ? { id: r.vet.id, fullName: r.vet.fullName } : null,
    };
  }

  private async reservationCharts(clinicId: string, range: Range) {
    const [daily, statusDistribution, topServices] = await Promise.all([
      this.reservationsPerDay(clinicId, range),
      this.statusDistribution(clinicId, range),
      this.topServices(clinicId, range),
    ]);
    return { daily, statusDistribution, topServices };
  }

  // ---- reports ----

  async financialReport(ctx: ClinicContext, query: ReportRangeDto) {
    const range = this.resolveRange(query);
    const previous = this.previousRange(range);
    const clinicId = ctx.clinicId;

    const [current, before, failedCount, trend, byService, byVet, recent] =
      await Promise.all([
        this.revenueTotals(clinicId, range),
        this.revenueTotals(clinicId, previous),
        this.paymentsQuery(clinicId)
          .where('p.status = :failed', { failed: PaymentStatus.FAILED })
          .andWhere('p.createdAt >= :start AND p.createdAt < :end', range)
          .getCount(),
        this.revenueTrend(clinicId, range),
        this.revenueByService(clinicId, range),
        this.revenueByVet(clinicId, range),
        this.recentTransactions(clinicId),
      ]);

    return {
      from: range.from,
      to: range.to,
      totalRevenue: current.revenue,
      changePercent: percentChange(current.revenue, before.revenue),
      transactionCount: current.count,
      averagePerTransaction: current.count
        ? Math.round(current.revenue / current.count)
        : 0,
      failedPayments: failedCount,
      gatewayFees: current.fees,
      // Revenue after refunds, minus the fees the gateway kept.
      netProfit: current.revenue - current.fees,
      trend,
      byService,
      byVet,
      recentTransactions: recent,
    };
  }

  async financialExport(ctx: ClinicContext, query: ReportRangeDto) {
    const range = this.resolveRange(query);
    const rows = await this.paymentsQuery(ctx.clinicId)
      .innerJoinAndSelect('p.user', 'user')
      .where('p.createdAt >= :start AND p.createdAt < :end', range)
      .orderBy('p.createdAt', 'DESC')
      .getMany();
    return { range, rows };
  }

  async reservationsReport(ctx: ClinicContext, query: ReportRangeDto) {
    const range = this.resolveRange(query);
    const previous = this.previousRange(range);
    const clinicId = ctx.clinicId;

    const [daily, statusDistribution, topServices, previousTotal] =
      await Promise.all([
        this.reservationsPerDay(clinicId, range),
        this.statusDistribution(clinicId, range),
        this.topServices(clinicId, range),
        this.countReservations(clinicId, previous),
      ]);

    const total = Object.values(statusDistribution).reduce((a, b) => a + b, 0);
    const rate = (status: ReservationStatus) =>
      total ? Math.round((statusDistribution[status] / total) * 1000) / 10 : 0;
    return {
      from: range.from,
      to: range.to,
      total,
      changePercent: percentChange(total, previousTotal),
      completionRatePercent: rate(ReservationStatus.COMPLETED),
      cancellationRatePercent: rate(ReservationStatus.CANCELLED),
      noShowRatePercent: rate(ReservationStatus.NO_SHOW),
      averagePerDay: Math.round((total / range.days) * 10) / 10,
      daily,
      statusDistribution,
      topServices,
    };
  }

  // ---- queries ----

  private reservationsQuery(clinicId: string) {
    return this.dataSource
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .where('r.clinicId = :clinicId', { clinicId });
  }

  /** Payments that belong to the clinic through their reservation. */
  private paymentsQuery(clinicId: string) {
    return this.dataSource
      .getRepository(Payment)
      .createQueryBuilder('p')
      .innerJoinAndSelect('p.reservation', 'r', 'r.clinicId = :clinicId', {
        clinicId,
      });
  }

  private paidInRange(clinicId: string, range: Range) {
    return this.dataSource
      .getRepository(Payment)
      .createQueryBuilder('p')
      .innerJoin('p.reservation', 'r', 'r.clinicId = :clinicId', { clinicId })
      .where('p.status IN (:...paid)', { paid: PAID_STATUSES })
      .andWhere('p.paidAt >= :start AND p.paidAt < :end', {
        start: range.start,
        end: range.end,
      });
  }

  private countReservations(clinicId: string, range: Range) {
    return this.reservationsQuery(clinicId)
      .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', range)
      .getCount();
  }

  private async revenueTotals(clinicId: string, range: Range) {
    const row = await this.paidInRange(clinicId, range)
      .select('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'revenue')
      .addSelect('COALESCE(SUM(p.gatewayFee), 0)', 'fees')
      .addSelect('COUNT(*)', 'count')
      .getRawOne<{ revenue: string; fees: string; count: string }>();
    return {
      revenue: Number(row?.revenue ?? 0),
      fees: Number(row?.fees ?? 0),
      count: Number(row?.count ?? 0),
    };
  }

  private async revenueSeries(clinicId: string, range: Range) {
    const rows = await this.paidInRange(clinicId, range)
      .select(tehranDay('p.paidAt'), 'day')
      .addSelect('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'sum')
      .groupBy('day')
      .getRawMany<{ day: string; sum: string }>();
    const byDay = new Map(rows.map((row) => [row.day, Number(row.sum)]));
    return this.fillDays(range, (day) => byDay.get(day) ?? 0).map((point) => ({
      date: point.date,
      revenue: point.value,
    }));
  }

  /** Daily buckets for short ranges, monthly (Gregorian) for long ones. */
  private async revenueTrend(clinicId: string, range: Range) {
    if (range.days <= DAILY_BUCKET_MAX_DAYS) {
      return {
        bucket: 'day' as const,
        points: await this.revenueSeries(clinicId, range),
      };
    }
    const rows = await this.paidInRange(clinicId, range)
      .select(tehranDay('p.paidAt', 'YYYY-MM'), 'month')
      .addSelect('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'sum')
      .groupBy('month')
      .orderBy('month', 'ASC')
      .getRawMany<{ month: string; sum: string }>();
    return {
      bucket: 'month' as const,
      points: rows.map((row) => ({
        date: row.month,
        revenue: Number(row.sum),
      })),
    };
  }

  private async revenueByService(clinicId: string, range: Range) {
    const rows = await this.paidInRange(clinicId, range)
      .select('r.serviceName', 'serviceName')
      .addSelect(
        'COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)',
        'revenue',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.serviceName')
      .orderBy('revenue', 'DESC')
      .limit(10)
      .getRawMany<{ serviceName: string; revenue: string; count: string }>();
    return rows.map((row) => ({
      serviceName: row.serviceName,
      revenue: Number(row.revenue),
      count: Number(row.count),
    }));
  }

  private async revenueByVet(clinicId: string, range: Range) {
    const rows = await this.paidInRange(clinicId, range)
      .leftJoin('r.vet', 'vet')
      .select('r.vetId', 'vetId')
      .addSelect('vet.fullName', 'fullName')
      .addSelect(
        'COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)',
        'revenue',
      )
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.vetId')
      .addGroupBy('vet.fullName')
      .orderBy('revenue', 'DESC')
      .limit(10)
      .getRawMany<{
        vetId: string | null;
        fullName: string | null;
        revenue: string;
        count: string;
      }>();
    return rows.map((row) => ({
      vetId: row.vetId,
      fullName: row.fullName,
      revenue: Number(row.revenue),
      count: Number(row.count),
    }));
  }

  private async recentTransactions(clinicId: string) {
    const payments = await this.paymentsQuery(clinicId)
      .leftJoinAndSelect('p.user', 'user')
      .orderBy('p.createdAt', 'DESC')
      .take(10)
      .getMany();
    return payments.map((p) => ({
      id: p.id,
      code: `TX-${p.number}`,
      status: p.status,
      finalAmount: p.finalAmount,
      refundedAmount: p.refundedAmount,
      serviceName: p.reservation?.serviceName ?? null,
      payer: p.user?.fullName ?? null,
      at: p.paidAt ?? p.createdAt,
    }));
  }

  private async reservationsPerDay(clinicId: string, range: Range) {
    const rows = await this.reservationsQuery(clinicId)
      .select(tehranDay('r.scheduledAt'), 'day')
      .addSelect('COUNT(*)', 'count')
      .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', range)
      .andWhere('r.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      })
      .groupBy('day')
      .getRawMany<{ day: string; count: string }>();
    const byDay = new Map(rows.map((row) => [row.day, Number(row.count)]));
    return this.fillDays(range, (day) => byDay.get(day) ?? 0).map((point) => ({
      date: point.date,
      count: point.value,
    }));
  }

  private async statusDistribution(clinicId: string, range: Range) {
    const rows = await this.reservationsQuery(clinicId)
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', range)
      .groupBy('r.status')
      .getRawMany<{ status: ReservationStatus; count: string }>();
    const counts = this.emptyStatusCounts();
    for (const row of rows) counts[row.status] = Number(row.count);
    return counts;
  }

  private async topServices(clinicId: string, range: Range) {
    const rows = await this.reservationsQuery(clinicId)
      .select('r.serviceName', 'serviceName')
      .addSelect('COUNT(*)', 'count')
      .addSelect(
        `COALESCE(SUM(r.price) FILTER (WHERE r.status = '${ReservationStatus.COMPLETED}'), 0)`,
        'revenue',
      )
      .andWhere('r.scheduledAt >= :start AND r.scheduledAt < :end', range)
      .andWhere('r.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      })
      .groupBy('r.serviceName')
      .orderBy('count', 'DESC')
      .limit(5)
      .getRawMany<{ serviceName: string; count: string; revenue: string }>();
    return rows.map((row) => ({
      serviceName: row.serviceName,
      count: Number(row.count),
      completedRevenue: Number(row.revenue),
    }));
  }

  // ---- helpers ----

  private emptyStatusCounts(): Record<ReservationStatus, number> {
    return Object.fromEntries(
      Object.values(ReservationStatus).map((status) => [status, 0]),
    ) as Record<ReservationStatus, number>;
  }

  private toRange(from: string, to: string): Range {
    const start = tehranDayRange(from).start;
    const end = tehranDayRange(to).end;
    return {
      from,
      to,
      start,
      end,
      days: Math.round((end.getTime() - start.getTime()) / 86_400_000),
    };
  }

  private resolveRange(query: ReportRangeDto): Range {
    const to = query.to?.slice(0, 10) ?? tehranToday();
    const from = query.from?.slice(0, 10) ?? addDays(to, -29);
    const range = this.toRange(from, to);
    if (range.days < 1) throw new BadRequestException('بازه تاریخ نامعتبر است');
    if (range.days > MAX_REPORT_DAYS) {
      throw new BadRequestException(
        `بازه گزارش نباید بیشتر از ${MAX_REPORT_DAYS} روز باشد`,
      );
    }
    return range;
  }

  /** The same-length period right before `range`. */
  private previousRange(range: Range): Range {
    const to = addDays(range.from, -1);
    return this.toRange(addDays(to, -(range.days - 1)), to);
  }

  private fillDays(range: Range, valueOf: (day: string) => number) {
    const points: { date: string; value: number }[] = [];
    for (let i = 0; i < range.days; i++) {
      const date = addDays(range.from, i);
      points.push({ date, value: valueOf(date) });
    }
    return points;
  }
}
