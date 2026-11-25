import { Injectable } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import {
  PaymentStatus,
  ReservationStatus,
  TicketStatus,
} from '../../common/enums/admin-panel.enums';
import { ClinicVerificationStatus } from '../../common/enums/clinic-enums';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { ClinicReview } from '../clinics/entities/clinic-review.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Organization } from '../organizations/entities/organization.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SupportTicket } from '../support/entities/support-ticket.entity';
import { User } from '../users/entities/user.entity';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import { VetReview } from '../vets/entities/vet-review.entity';

export type DashboardPeriod = '7d' | '30d' | '90d' | '1y';

const PERIOD_DAYS: Record<DashboardPeriod, number> = {
  '7d': 7,
  '30d': 30,
  '90d': 90,
  '1y': 365,
};
const DAY_MS = 24 * 60 * 60 * 1000;
const PUBLIC_ROLES = [
  UserRole.USER,
  UserRole.VET,
  UserRole.CLINIC,
  UserRole.PETSHOP,
  UserRole.SHELTER,
];

const changePercent = (current: number, previous: number): number | null =>
  previous ? Math.round(((current - previous) / previous) * 1000) / 10 : null;

@Injectable()
export class DashboardService {
  constructor(private readonly dataSource: DataSource) {}

  async getDashboard(period: DashboardPeriod) {
    const now = new Date();
    const days = PERIOD_DAYS[period];
    const from = new Date(now.getTime() - days * DAY_MS);
    const previousFrom = new Date(from.getTime() - days * DAY_MS);

    const bucket = period === '1y' ? 'month' : 'day';
    const [
      cards,
      trends,
      reservationOverview,
      growth,
      map,
      recentActivity,
      issues,
    ] = await Promise.all([
      this.getCards(from, previousFrom),
      this.getTrends(from, bucket),
      this.getReservationOverview(from),
      this.getGrowth(from, bucket),
      this.getMap(),
      this.getRecentActivity(),
      this.getIssues(from),
    ]);

    return {
      period,
      from,
      to: now,
      cards,
      trends,
      reservationOverview,
      growth,
      map,
      recentActivity,
      issues,
    };
  }

  private async getCards(from: Date, previousFrom: Date) {
    const users = this.dataSource.getRepository(User);
    const reservations = this.dataSource.getRepository(Reservation);
    const payments = this.dataSource.getRepository(Payment);

    const newUsers = (start: Date, end: Date) =>
      users
        .createQueryBuilder('u')
        .where('u.role IN (:...roles)', { roles: PUBLIC_ROLES })
        .andWhere('u.createdAt >= :start AND u.createdAt < :end', {
          start,
          end,
        })
        .getCount();
    const reservationCount = (start: Date, end: Date) =>
      reservations
        .createQueryBuilder('r')
        .where('r.createdAt >= :start AND r.createdAt < :end', { start, end })
        .getCount();
    const revenue = (start: Date, end: Date) =>
      payments
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'sum')
        .where('p.status IN (:...statuses)', {
          statuses: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED],
        })
        .andWhere('p.paidAt >= :start AND p.paidAt < :end', { start, end })
        .getRawOne<{ sum: string }>()
        .then((row) => Number(row?.sum ?? 0));

    const end = new Date(Date.now() + DAY_MS);
    const [
      byRoleRows,
      usersNow,
      usersBefore,
      reservationsNow,
      reservationsBefore,
      revenueNow,
      revenueBefore,
      activeSubscriptions,
      newSubscriptions,
      petsTotal,
      petsNow,
      petsBefore,
    ] = await Promise.all([
      users
        .createQueryBuilder('u')
        .select('u.role', 'role')
        .addSelect('COUNT(*)', 'count')
        .where('u.role IN (:...roles)', { roles: PUBLIC_ROLES })
        .groupBy('u.role')
        .getRawMany<{ role: UserRole; count: string }>(),
      newUsers(from, end),
      newUsers(previousFrom, from),
      reservationCount(from, end),
      reservationCount(previousFrom, from),
      revenue(from, end),
      revenue(previousFrom, from),
      this.countPaidSubscriptions(),
      this.countPaidSubscriptions(from),
      this.dataSource.getRepository(Pet).count(),
      this.dataSource
        .getRepository(Pet)
        .createQueryBuilder('p')
        .where('p.createdAt >= :start', { start: from })
        .getCount(),
      this.dataSource
        .getRepository(Pet)
        .createQueryBuilder('p')
        .where('p.createdAt >= :start AND p.createdAt < :end', {
          start: previousFrom,
          end: from,
        })
        .getCount(),
    ]);

    const byRole = Object.fromEntries(PUBLIC_ROLES.map((role) => [role, 0]));
    let totalUsers = 0;
    for (const row of byRoleRows) {
      byRole[row.role] = Number(row.count);
      totalUsers += Number(row.count);
    }

    return {
      users: {
        total: totalUsers,
        newInPeriod: usersNow,
        changePercent: changePercent(usersNow, usersBefore),
        byRole,
      },
      reservations: {
        inPeriod: reservationsNow,
        changePercent: changePercent(reservationsNow, reservationsBefore),
      },
      revenue: {
        amount: revenueNow,
        changePercent: changePercent(revenueNow, revenueBefore),
      },
      subscriptions: {
        active: activeSubscriptions,
        newInPeriod: newSubscriptions,
      },
      pets: {
        total: petsTotal,
        newInPeriod: petsNow,
        changePercent: changePercent(petsNow, petsBefore),
      },
    };
  }

  /**
   * One value per bucket (day, or month for the 1y period) for each card, so
   * the dashboard can draw sparklines. Missing buckets are zero-filled.
   */
  private async getTrends(from: Date, bucket: 'day' | 'month') {
    const series = async (
      entity: new () => object,
      dateColumn: string,
      valueSql = 'COUNT(*)',
      where?: [string, Record<string, unknown>],
    ): Promise<number[]> => {
      const qb = this.dataSource
        .getRepository(entity)
        .createQueryBuilder('t')
        .select(`date_trunc('${bucket}', t.${dateColumn})`, 'bucket')
        .addSelect(valueSql, 'value')
        .where(`t.${dateColumn} >= :from`, { from });
      if (where) qb.andWhere(where[0], where[1]);
      const rows = await qb
        .groupBy('bucket')
        .orderBy('bucket', 'ASC')
        .getRawMany<{ bucket: Date; value: string }>();
      const byKey = new Map(
        rows.map((row) => [new Date(row.bucket).getTime(), Number(row.value)]),
      );
      const out: number[] = [];
      const cursor = new Date(from);
      if (bucket === 'month') cursor.setUTCDate(1);
      cursor.setUTCHours(0, 0, 0, 0);
      while (cursor.getTime() <= Date.now()) {
        out.push(byKey.get(cursor.getTime()) ?? 0);
        if (bucket === 'month') cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        else cursor.setUTCDate(cursor.getUTCDate() + 1);
      }
      return out;
    };
    const [users, pets, reservations, revenue, subscriptions] =
      await Promise.all([
        series(User, 'createdAt', 'COUNT(*)', [
          't.role IN (:...roles)',
          { roles: PUBLIC_ROLES },
        ]),
        series(Pet, 'createdAt'),
        series(Reservation, 'createdAt'),
        series(
          Payment,
          'paidAt',
          'COALESCE(SUM(t.finalAmount - t.refundedAmount), 0)',
          [
            't.status IN (:...statuses)',
            { statuses: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED] },
          ],
        ),
        series(Subscription, 'createdAt', 'COUNT(*)', [
          't.plan != :free',
          { free: SubscriptionPlan.FREE },
        ]),
      ]);
    return { users, pets, reservations, revenue, subscriptions };
  }

  private countPaidSubscriptions(since?: Date): Promise<number> {
    const qb = this.dataSource
      .getRepository(Subscription)
      .createQueryBuilder('s')
      .where('s.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('s.plan != :free', { free: SubscriptionPlan.FREE });
    if (since) qb.andWhere('s.createdAt >= :since', { since });
    return qb.getCount();
  }

  private async getReservationOverview(from: Date) {
    const repo = this.dataSource.getRepository(Reservation);
    const rows = await repo
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .where('r.scheduledAt >= :from', { from })
      .groupBy('r.status')
      .getRawMany<{ status: ReservationStatus; count: string }>();
    const byStatus = Object.fromEntries(
      Object.values(ReservationStatus).map((status) => [status, 0]),
    ) as Record<ReservationStatus, number>;
    for (const row of rows) byStatus[row.status] = Number(row.count);

    const active = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];
    const [today, upcoming] = await Promise.all([
      repo
        .createQueryBuilder('r')
        .where(
          'r.scheduledAt >= CURRENT_DATE AND r.scheduledAt < CURRENT_DATE + 1',
        )
        .andWhere('r.status IN (:...active)', { active })
        .getCount(),
      repo
        .createQueryBuilder('r')
        .where(
          "r.scheduledAt >= now() AND r.scheduledAt < now() + interval '7 days'",
        )
        .andWhere('r.status IN (:...active)', { active })
        .getCount(),
    ]);
    return { today, upcomingWeek: upcoming, byStatus };
  }

  /** New registrations per bucket (day or month), split by account type. */
  private async getGrowth(from: Date, bucket: 'day' | 'month') {
    const rows = await this.dataSource
      .getRepository(User)
      .createQueryBuilder('u')
      .select(`date_trunc('${bucket}', u.createdAt)`, 'bucket')
      .addSelect('u.role', 'role')
      .addSelect('COUNT(*)', 'count')
      .where('u.role IN (:...roles)', { roles: PUBLIC_ROLES })
      .andWhere('u.createdAt >= :from', { from })
      .groupBy('bucket')
      .addGroupBy('u.role')
      .orderBy('bucket', 'ASC')
      .getRawMany<{ bucket: Date; role: UserRole; count: string }>();

    const series = new Map<string, Record<string, number | string>>();
    for (const row of rows) {
      const key = new Date(row.bucket).toISOString();
      if (!series.has(key)) {
        series.set(key, {
          date: key,
          ...Object.fromEntries(PUBLIC_ROLES.map((role) => [role, 0])),
        });
      }
      series.get(key)![row.role] = Number(row.count);
    }
    return [...series.values()];
  }

  /** Account counts per province for the map card. */
  private async getMap() {
    const [clinics, organizations] = await Promise.all([
      this.dataSource
        .getRepository(Clinic)
        .createQueryBuilder('c')
        .innerJoin('c.user', 'u')
        .select('c.province', 'province')
        .addSelect('COUNT(*)', 'count')
        .where('u.deletedAt IS NULL')
        .groupBy('c.province')
        .getRawMany<{ province: string; count: string }>(),
      this.dataSource
        .getRepository(Organization)
        .createQueryBuilder('o')
        .innerJoin('o.user', 'u')
        .select('o.province', 'province')
        .addSelect('o.kind', 'kind')
        .addSelect('COUNT(*)', 'count')
        .where('u.deletedAt IS NULL')
        .groupBy('o.province')
        .addGroupBy('o.kind')
        .getRawMany<{ province: string; kind: string; count: string }>(),
    ]);

    const provinces = new Map<
      string,
      { province: string; clinics: number; petshops: number; shelters: number }
    >();
    const entry = (province: string) => {
      if (!provinces.has(province)) {
        provinces.set(province, {
          province,
          clinics: 0,
          petshops: 0,
          shelters: 0,
        });
      }
      return provinces.get(province)!;
    };
    for (const row of clinics) entry(row.province).clinics = Number(row.count);
    for (const row of organizations) {
      if (row.kind === 'petshop')
        entry(row.province).petshops = Number(row.count);
      else entry(row.province).shelters = Number(row.count);
    }
    return [...provinces.values()].sort(
      (a, b) =>
        b.clinics +
        b.petshops +
        b.shelters -
        (a.clinics + a.petshops + a.shelters),
    );
  }

  private async getRecentActivity() {
    const limit = 10;
    const [users, reservations, payments, tickets] = await Promise.all([
      this.dataSource.getRepository(User).find({
        where: {},
        order: { createdAt: 'DESC' },
        take: limit,
        select: { id: true, fullName: true, role: true, createdAt: true },
      }),
      this.dataSource.getRepository(Reservation).find({
        relations: { owner: true },
        order: { createdAt: 'DESC' },
        take: limit,
      }),
      this.dataSource.getRepository(Payment).find({
        where: { status: PaymentStatus.SUCCESS },
        order: { paidAt: 'DESC' },
        take: limit,
      }),
      this.dataSource.getRepository(SupportTicket).find({
        order: { createdAt: 'DESC' },
        take: limit,
      }),
    ]);

    const events = [
      ...users
        .filter((user) => user.role !== UserRole.ADMIN)
        .map((user) => ({
          type: 'user_registered',
          title: `${user.fullName ?? 'کاربر جدید'} ثبت‌نام کرد`,
          refId: user.id,
          at: user.createdAt,
        })),
      ...reservations.map((r) => ({
        type: 'reservation_created',
        title: `رزرو BK-${r.number} برای ${r.owner.fullName ?? 'کاربر'} ثبت شد`,
        refId: r.id,
        at: r.createdAt,
      })),
      ...payments.map((p) => ({
        type: 'payment_succeeded',
        title: `پرداخت TX-${p.number} به مبلغ ${p.finalAmount} تومان انجام شد`,
        refId: p.id,
        at: p.paidAt ?? p.createdAt,
      })),
      ...tickets.map((t) => ({
        type: 'ticket_opened',
        title: `تیکت جدید: ${t.subject}`,
        refId: t.id,
        at: t.createdAt,
      })),
    ];
    return events
      .sort((a, b) => b.at.getTime() - a.at.getTime())
      .slice(0, limit);
  }

  /** Things that need an admin's attention. */
  private async getIssues(from: Date) {
    const pending = ApprovalStatus.PENDING;
    const [
      pendingVets,
      pendingClinics,
      pendingOrganizations,
      pendingVetReviews,
      pendingClinicReviews,
      openTickets,
      failedPayments,
    ] = await Promise.all([
      this.dataSource
        .getRepository(VetProfile)
        .count({ where: { verificationStatus: pending } }),
      this.dataSource.getRepository(Clinic).count({
        where: { verificationStatus: ClinicVerificationStatus.PENDING },
      }),
      this.dataSource.getRepository(Organization).count({
        where: { verificationStatus: ClinicVerificationStatus.PENDING },
      }),
      this.dataSource
        .getRepository(VetReview)
        .count({ where: { status: pending } }),
      this.dataSource
        .getRepository(ClinicReview)
        .count({ where: { status: pending } }),
      this.dataSource
        .getRepository(SupportTicket)
        .count({ where: { status: TicketStatus.OPEN } }),
      this.dataSource
        .getRepository(Payment)
        .createQueryBuilder('p')
        .where('p.status = :status', { status: PaymentStatus.FAILED })
        .andWhere('p.createdAt >= :from', { from })
        .getCount(),
    ]);
    return {
      pendingVetApprovals: pendingVets,
      pendingClinicApprovals: pendingClinics,
      pendingOrganizationApprovals: pendingOrganizations,
      pendingReviews: pendingVetReviews + pendingClinicReviews,
      openTickets,
      failedPayments,
    };
  }
}
