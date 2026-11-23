import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
  ReservationStatus,
} from '../../common/enums/admin-panel.enums';
import { NotificationType } from '../../common/enums/owner-app.enums';
import { NotificationsService } from '../notifications/notifications.service';
import {
  Payment,
  type PaymentTimelineEntry,
} from '../payments/entities/payment.entity';
import { PaymentGatewayService } from '../payments/gateways/payment-gateway.service';
import { resolveShareBase } from '../providers/provider-share-url';
import { ReservationEvent } from '../reservations/entities/reservation-event.entity';
import { Reservation } from '../reservations/entities/reservation.entity';

export type ReservationPaymentStatus =
  | 'unpaid'
  | 'pending'
  | 'paid'
  | 'refunded';

export interface ReservationPaymentState {
  paymentStatus: ReservationPaymentStatus;
  canPay: boolean;
}

interface CallbackResult {
  status: 'success' | 'failed';
  paymentId: string;
  reservationId: string | null;
  message?: string;
}

/** Statuses an owner can still pay for. */
const PAYABLE = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];
/** A started checkout counts as in progress for this long. */
const PENDING_WINDOW_MS = 30 * 60_000;

/** Online payment for owner reservations, through PaymentGatewayService. */
@Injectable()
export class ReservationPaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly gatewayService: PaymentGatewayService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
    private readonly dataSource: DataSource,
  ) {}

  /** Payment state per reservation, for list and detail responses. */
  async stateFor(
    reservations: Reservation[],
  ): Promise<Map<string, ReservationPaymentState>> {
    const ids = reservations.map((r) => r.id);
    const payments = ids.length
      ? await this.paymentsRepository.find({
          where: {
            reservationId: In(ids),
            purpose: PaymentPurpose.RESERVATION,
          },
          order: { createdAt: 'DESC' },
        })
      : [];
    const byReservation = new Map<string, Payment[]>();
    for (const payment of payments) {
      const list = byReservation.get(payment.reservationId!) ?? [];
      list.push(payment);
      byReservation.set(payment.reservationId!, list);
    }
    return new Map(
      reservations.map((r) => {
        const paymentStatus = this.statusOf(byReservation.get(r.id) ?? []);
        return [
          r.id,
          {
            paymentStatus,
            canPay:
              PAYABLE.includes(r.status) &&
              r.scheduledAt.getTime() > Date.now() &&
              (paymentStatus === 'unpaid' || paymentStatus === 'pending') &&
              r.price > 0,
          },
        ];
      }),
    );
  }

  /** Creates a pending payment for the reservation; returns where to send the payer. */
  async checkout(ownerId: string, reservationId: string, gateway?: string) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id: reservationId, ownerId },
    });
    if (!reservation) throw new NotFoundException('رزرو یافت نشد');
    const state = (await this.stateFor([reservation])).get(reservation.id)!;
    if (state.paymentStatus === 'paid' || state.paymentStatus === 'refunded') {
      throw new ConflictException('این رزرو قبلاً پرداخت شده است');
    }
    if (!state.canPay) {
      throw new BadRequestException('این رزرو قابل پرداخت نیست');
    }

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        userId: ownerId,
        reservationId: reservation.id,
        purpose: PaymentPurpose.RESERVATION,
        amount: reservation.price,
        discount: 0,
        gatewayFee: 0,
        finalAmount: reservation.price,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        timeline: [this.entry('درخواست پرداخت رزرو ایجاد شد')],
      }),
    );

    const appUrl = (
      this.configService.get<string>('appUrl') ?? 'http://localhost:3000'
    ).replace(/\/$/, '');
    const callbackUrl = `${appUrl}/api/v1/reservations/payments/callback?paymentId=${payment.id}`;
    try {
      const result = await this.gatewayService.initiate(gateway, {
        paymentId: payment.id,
        amountToman: payment.finalAmount,
        description: `پرداخت رزرو «${reservation.serviceName}»`,
        callbackUrl,
      });
      await this.paymentsRepository.update(payment.id, {
        gateway: result.gatewayCode,
        gatewayReference: result.authority,
        timeline: [
          ...payment.timeline,
          this.entry('کاربر به درگاه پرداخت منتقل شد'),
        ],
      });
      return {
        paymentId: payment.id,
        amount: payment.finalAmount,
        gateway: result.gatewayCode,
        redirectUrl: result.redirectUrl,
      };
    } catch (error) {
      await this.paymentsRepository.update(payment.id, {
        status: PaymentStatus.FAILED,
        timeline: [
          ...payment.timeline,
          this.entry('ارتباط با درگاه ناموفق بود'),
        ],
      });
      throw error;
    }
  }

  /** The gateway sends the payer back here; verify, then mark paid. */
  async handleCallback(
    paymentId: string,
    authority: string | undefined,
    status: string | undefined,
  ): Promise<CallbackResult> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.purpose !== PaymentPurpose.RESERVATION) {
      throw new NotFoundException('پرداخت یافت نشد');
    }
    const base = { paymentId, reservationId: payment.reservationId };
    if (payment.status === PaymentStatus.SUCCESS) {
      return { ...base, status: 'success' }; // Repeated callback.
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return {
        ...base,
        status: 'failed',
        message: 'این پرداخت دیگر قابل پیگیری نیست',
      };
    }
    if (!authority || authority !== payment.gatewayReference) {
      return this.fail(payment, 'شناسه پرداخت با درخواست مطابقت ندارد');
    }
    if (status !== 'OK') return this.fail(payment, 'پرداخت توسط کاربر لغو شد');

    const verification = await this.gatewayService.verify(
      payment.gateway ?? 'sandbox',
      { authority, amountToman: payment.finalAmount },
    );
    if (!verification.success) {
      return this.fail(
        payment,
        verification.message ?? 'تایید پرداخت ناموفق بود',
      );
    }

    // Only one concurrent callback may flip pending → success.
    const paid = await this.dataSource.transaction(async (manager) => {
      const claimed = await manager.update(
        Payment,
        { id: payment.id, status: PaymentStatus.PENDING },
        {
          status: PaymentStatus.SUCCESS,
          paidAt: new Date(),
          rrn: verification.referenceId ?? null,
          timeline: [
            ...payment.timeline,
            this.entry('پرداخت توسط درگاه تایید شد'),
          ],
        },
      );
      if (!claimed.affected) return false;
      if (payment.reservationId) {
        await manager.insert(ReservationEvent, {
          reservationId: payment.reservationId,
          type: 'paid',
          message: 'پرداخت رزرو انجام شد',
          ...(payment.userId ? { actorId: payment.userId } : {}),
        });
      }
      return true;
    });

    if (paid && payment.userId) {
      await this.notificationsService.notify(payment.userId, {
        type: NotificationType.PAYMENT,
        title: 'پرداخت رزرو انجام شد',
        body: 'پرداخت شما با موفقیت انجام شد.',
        data: {
          paymentId: payment.id,
          ...(payment.reservationId
            ? { reservationId: payment.reservationId }
            : {}),
        },
        dedupeKey: `reservation-paid:${payment.id}`,
      });
    }
    return { ...base, status: 'success' };
  }

  /** Frontend page that shows the outcome. */
  resultUrl(result: CallbackResult) {
    const base = resolveShareBase({
      publicSiteUrl: this.configService.get<string>('publicSiteUrl'),
      frontendRedirectUrl: this.configService.get<string>(
        'frontend.redirectUrl',
      ),
      corsOrigins: this.configService.get<string[]>('cors.origins'),
    });
    const query = new URLSearchParams({
      status: result.status,
      paymentId: result.paymentId,
    });
    if (result.reservationId) query.set('reservationId', result.reservationId);
    if (result.message) query.set('message', result.message);
    return `${base}/services/payment?${query.toString()}`;
  }

  private statusOf(payments: Payment[]): ReservationPaymentStatus {
    const success = payments.find((p) => p.status === PaymentStatus.SUCCESS);
    if (success) return 'paid';
    if (payments.some((p) => p.status === PaymentStatus.REFUNDED))
      return 'refunded';
    // Only the newest attempt counts: a cancelled checkout after an abandoned one is "unpaid".
    const latest = payments[0];
    const inProgress =
      latest?.status === PaymentStatus.PENDING &&
      Date.now() - latest.createdAt.getTime() < PENDING_WINDOW_MS;
    return inProgress ? 'pending' : 'unpaid';
  }

  private async fail(payment: Payment, message: string): Promise<CallbackResult> {
    await this.paymentsRepository.update(
      { id: payment.id, status: PaymentStatus.PENDING },
      {
        status: PaymentStatus.FAILED,
        timeline: [...payment.timeline, this.entry(message)],
      },
    );
    return {
      status: 'failed',
      paymentId: payment.id,
      reservationId: payment.reservationId,
      message,
    };
  }

  private entry(message: string): PaymentTimelineEntry {
    return { at: new Date().toISOString(), message };
  }
}
