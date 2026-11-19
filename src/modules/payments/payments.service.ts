import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Paginated, paginated } from '../../common/dto/pagination-query.dto';
import { PaymentStatus } from '../../common/enums/admin-panel.enums';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PremiumPlan } from '../plans/entities/premium-plan.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { User } from '../users/entities/user.entity';
import {
  CreatePaymentDto,
  PaymentStatsQueryDto,
  QueryPaymentsDto,
  RefundPaymentDto,
  UpdatePaymentDto,
} from './dto/payment.dto';
import { Payment, PaymentTimelineEntry } from './entities/payment.entity';

const STATUS_LABELS: Record<PaymentStatus, string> = {
  [PaymentStatus.PENDING]: 'در انتظار پرداخت',
  [PaymentStatus.SUCCESS]: 'پرداخت موفق',
  [PaymentStatus.FAILED]: 'پرداخت ناموفق',
  [PaymentStatus.REFUNDED]: 'بازگشت وجه',
};

export const paymentCode = (number: number) => `TX-${number}`;

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(PremiumPlan)
    private readonly plansRepository: Repository<PremiumPlan>,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
  ) {}

  async findAll(
    query: QueryPaymentsDto,
  ): Promise<Paginated<ReturnType<PaymentsService['toListItem']>>> {
    const qb = this.baseQuery();

    if (query.search) {
      qb.andWhere(
        `(CAST(p.number AS text) = :code OR p.gatewayReference ILIKE :s OR p.rrn ILIKE :s OR user.fullName ILIKE :s OR user.phoneNumber ILIKE :s)`,
        { code: query.search.replace(/^TX-/i, ''), s: `%${query.search}%` },
      );
    }
    for (const key of [
      'status',
      'method',
      'purpose',
      'gateway',
      'userId',
      'reservationId',
    ] as const) {
      if (query[key]) qb.andWhere(`p.${key} = :${key}`, { [key]: query[key] });
    }
    if (query.from) qb.andWhere('p.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('p.createdAt < :to::date + 1', { to: query.to });

    const [payments, total] = await qb
      .orderBy('p.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(
      payments.map((p) => this.toListItem(p)),
      total,
      query,
    );
  }

  async getStats(query: PaymentStatsQueryDto) {
    const qb = this.paymentsRepository.createQueryBuilder('p');
    if (query.from) qb.andWhere('p.createdAt >= :from', { from: query.from });
    if (query.to) qb.andWhere('p.createdAt < :to::date + 1', { to: query.to });

    const rows = await qb
      .select('p.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .addSelect('COALESCE(SUM(p.finalAmount), 0)', 'gross')
      .addSelect('COALESCE(SUM(p.refundedAmount), 0)', 'refunded')
      .groupBy('p.status')
      .getRawMany<{
        status: PaymentStatus;
        count: string;
        gross: string;
        refunded: string;
      }>();

    const stats = {
      totalCount: 0,
      successCount: 0,
      failedCount: 0,
      pendingCount: 0,
      refundedCount: 0,
      netRevenue: 0,
      refundedAmount: 0,
    };
    for (const row of rows) {
      const count = Number(row.count);
      stats.totalCount += count;
      stats.refundedAmount += Number(row.refunded);
      if (row.status === PaymentStatus.SUCCESS) {
        stats.successCount = count;
        stats.netRevenue += Number(row.gross) - Number(row.refunded);
      } else if (row.status === PaymentStatus.REFUNDED) {
        stats.refundedCount = count;
        stats.netRevenue += Number(row.gross) - Number(row.refunded);
      } else if (row.status === PaymentStatus.FAILED) {
        stats.failedCount = count;
      } else {
        stats.pendingCount = count;
      }
    }
    return stats;
  }

  async findOne(id: string) {
    const payment = await this.baseQuery()
      .andWhere('p.id = :id', { id })
      .getOne();
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');

    const reservation = payment.reservation
      ? await this.describeReservation(payment.reservation)
      : null;
    const plan = payment.planId
      ? await this.plansRepository.findOne({ where: { id: payment.planId } })
      : null;
    return {
      ...this.toListItem(payment),
      statusLabel: STATUS_LABELS[payment.status],
      gatewayReference: payment.gatewayReference,
      rrn: payment.rrn,
      isSettled: payment.isSettled,
      amount: payment.amount,
      discount: payment.discount,
      gatewayFee: payment.gatewayFee,
      refundedAt: payment.refundedAt,
      refundReason: payment.refundReason,
      payer: payment.user
        ? {
            id: payment.user.id,
            fullName: payment.user.fullName,
            phoneNumber: payment.user.phoneNumber,
            email: payment.user.email,
          }
        : null,
      reservation,
      plan: plan ? { id: plan.id, name: plan.name } : null,
      timeline: payment.timeline,
      updatedAt: payment.updatedAt,
    };
  }

  async getReceipt(id: string) {
    const payment = await this.findOne(id);
    if (
      payment.status !== PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.REFUNDED
    ) {
      throw new BadRequestException('برای این پرداخت رسیدی صادر نشده است');
    }
    return {
      code: payment.code,
      paidAt: payment.paidAt,
      status: payment.status,
      statusLabel: payment.statusLabel,
      payer: payment.payer,
      method: payment.method,
      gateway: payment.gateway,
      gatewayReference: payment.gatewayReference,
      rrn: payment.rrn,
      reservation: payment.reservation
        ? {
            code: payment.reservation.code,
            serviceName: payment.reservation.serviceName,
            scheduledAt: payment.reservation.scheduledAt,
          }
        : null,
      amounts: {
        amount: payment.amount,
        discount: payment.discount,
        gatewayFee: payment.gatewayFee,
        finalAmount: payment.finalAmount,
        refundedAmount: payment.refundedAmount,
      },
    };
  }

  async create(dto: CreatePaymentDto) {
    await this.assertRefs(dto);
    const status = dto.status ?? PaymentStatus.PENDING;
    const payment = this.paymentsRepository.create({
      ...dto,
      paidAt: dto.paidAt
        ? new Date(dto.paidAt)
        : status === PaymentStatus.SUCCESS
          ? new Date()
          : null,
      status,
      finalAmount: this.computeFinal(dto.amount, dto.discount, dto.gatewayFee),
      timeline: [this.entry('پرداخت توسط ادمین ثبت شد')],
    });
    if (status !== PaymentStatus.PENDING) {
      payment.timeline.push(this.entry(STATUS_LABELS[status]));
    }
    const saved = await this.paymentsRepository.save(payment);
    return this.findOne(saved.id);
  }

  async update(id: string, dto: UpdatePaymentDto) {
    const payment = await this.getOrThrow(id);
    await this.assertRefs(dto);

    const { paidAt, status, ...rest } = dto;
    Object.assign(payment, rest);
    if (paidAt !== undefined) payment.paidAt = new Date(paidAt);
    payment.finalAmount = this.computeFinal(
      payment.amount,
      payment.discount,
      payment.gatewayFee,
    );
    if (payment.finalAmount < payment.refundedAmount) {
      throw new BadRequestException(
        'مبلغ نهایی نمی‌تواند کمتر از مبلغ بازگشتی باشد',
      );
    }
    if (status && status !== payment.status) {
      payment.status = status;
      payment.timeline = [
        ...payment.timeline,
        this.entry(STATUS_LABELS[status]),
      ];
      if (status === PaymentStatus.SUCCESS && !payment.paidAt) {
        payment.paidAt = new Date();
      }
    }
    await this.paymentsRepository.save(payment);
    return this.findOne(id);
  }

  /**
   * Records a refund. This does not call the payment gateway; the money
   * movement itself has to be done with the provider.
   */
  async refund(id: string, dto: RefundPaymentDto) {
    const payment = await this.getOrThrow(id);
    if (payment.status !== PaymentStatus.SUCCESS) {
      throw new BadRequestException(
        'فقط پرداخت‌های موفق قابل بازگشت وجه هستند',
      );
    }
    const remaining = payment.finalAmount - payment.refundedAmount;
    const amount = dto.amount ?? remaining;
    if (amount > remaining) {
      throw new BadRequestException(
        `مبلغ بازگشتی نمی‌تواند از ${remaining} تومان بیشتر باشد`,
      );
    }

    payment.refundedAmount += amount;
    payment.refundedAt = new Date();
    payment.refundReason = dto.reason;
    if (payment.refundedAmount === payment.finalAmount) {
      payment.status = PaymentStatus.REFUNDED;
    }
    payment.timeline = [
      ...payment.timeline,
      this.entry(`مبلغ ${amount} تومان بازگردانده شد: ${dto.reason}`),
    ];
    await this.paymentsRepository.save(payment);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.paymentsRepository.remove(await this.getOrThrow(id));
  }

  // ---- helpers ----

  private baseQuery() {
    return this.paymentsRepository
      .createQueryBuilder('p')
      .leftJoinAndSelect('p.user', 'user')
      .leftJoinAndSelect('p.reservation', 'reservation');
  }

  private async getOrThrow(id: string): Promise<Payment> {
    const payment = await this.paymentsRepository.findOne({ where: { id } });
    if (!payment) throw new NotFoundException('پرداخت یافت نشد');
    return payment;
  }

  private computeFinal(amount: number, discount = 0, gatewayFee = 0): number {
    if (discount > amount) {
      throw new BadRequestException('تخفیف نمی‌تواند از مبلغ بیشتر باشد');
    }
    return amount - discount + gatewayFee;
  }

  private entry(message: string): PaymentTimelineEntry {
    return { at: new Date().toISOString(), message };
  }

  private async assertRefs(dto: {
    userId?: string;
    reservationId?: string;
    planId?: string;
  }): Promise<void> {
    if (
      dto.userId &&
      !(await this.usersRepository.exists({ where: { id: dto.userId } }))
    ) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    if (
      dto.reservationId &&
      !(await this.reservationsRepository.exists({
        where: { id: dto.reservationId },
      }))
    ) {
      throw new NotFoundException('رزرو یافت نشد');
    }
    if (
      dto.planId &&
      !(await this.plansRepository.exists({ where: { id: dto.planId } }))
    ) {
      throw new NotFoundException('پلن یافت نشد');
    }
  }

  private async describeReservation(reservation: Reservation) {
    const [vet, clinic] = await Promise.all([
      reservation.vetId
        ? this.usersRepository.findOne({ where: { id: reservation.vetId } })
        : null,
      reservation.clinicId
        ? this.clinicsRepository.findOne({
            where: { userId: reservation.clinicId },
          })
        : null,
    ]);
    return {
      id: reservation.id,
      code: `BK-${reservation.number}`,
      serviceName: reservation.serviceName,
      scheduledAt: reservation.scheduledAt,
      status: reservation.status,
      vet: vet
        ? { id: vet.id, fullName: vet.fullName, phoneNumber: vet.phoneNumber }
        : null,
      clinic: clinic
        ? { id: clinic.userId, name: clinic.name, phone: clinic.phone }
        : null,
    };
  }

  private toListItem(p: Payment) {
    return {
      id: p.id,
      code: paymentCode(p.number),
      status: p.status,
      purpose: p.purpose,
      method: p.method,
      gateway: p.gateway,
      finalAmount: p.finalAmount,
      refundedAmount: p.refundedAmount,
      paidAt: p.paidAt,
      user: p.user
        ? {
            id: p.user.id,
            fullName: p.user.fullName,
            phoneNumber: p.user.phoneNumber,
          }
        : null,
      reservation: p.reservation
        ? {
            id: p.reservation.id,
            code: `BK-${p.reservation.number}`,
            serviceName: p.reservation.serviceName,
          }
        : null,
      createdAt: p.createdAt,
    };
  }
}
