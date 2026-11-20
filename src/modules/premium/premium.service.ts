import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Not, Repository } from 'typeorm';
import {
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from '../../common/enums/admin-panel.enums';
import { NotificationType } from '../../common/enums/owner-app.enums';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { NotificationsService } from '../notifications/notifications.service';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentGatewayService } from '../payments/gateways/payment-gateway.service';
import { PremiumPlan } from '../plans/entities/premium-plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { CheckoutDto } from './dto/premium.dto';

const DAY_MS = 86_400_000;

export interface CallbackResult {
  status: 'success' | 'failed';
  paymentId: string;
  message?: string;
}

const addMonths = (from: Date, months: number): Date => {
  const result = new Date(from);
  result.setMonth(result.getMonth() + months);
  return result;
};

@Injectable()
export class PremiumService {
  private readonly logger = new Logger(PremiumService.name);

  constructor(
    @InjectRepository(PremiumPlan)
    private readonly plansRepository: Repository<PremiumPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(Payment)
    private readonly paymentsRepository: Repository<Payment>,
    private readonly dataSource: DataSource,
    private readonly gatewayService: PaymentGatewayService,
    private readonly notificationsService: NotificationsService,
    private readonly configService: ConfigService,
  ) {}

  async listPlans() {
    const plans = await this.plansRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return plans.map((plan) => ({
      id: plan.id,
      name: plan.name,
      description: plan.description,
      color: plan.color,
      icon: plan.icon,
      badge: plan.badge,
      features: plan.features,
      basePrice: plan.basePrice,
      options: this.periodOptions(plan),
    }));
  }

  /** The signed-in user's subscription, or a free account. */
  async me(userId: string) {
    const [latest] = await this.subscriptionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });
    const now = Date.now();
    const active =
      latest &&
      latest.status === SubscriptionStatus.ACTIVE &&
      latest.plan !== SubscriptionPlan.FREE &&
      (!latest.expiresAt || latest.expiresAt.getTime() > now);
    if (!active) {
      return {
        isPremium: false,
        canCancel: false,
        plan: SubscriptionPlan.FREE,
        planDetails: null,
        expiresAt: null,
        daysRemaining: null,
      };
    }
    const planDetails = latest.planId
      ? await this.plansRepository.findOne({ where: { id: latest.planId } })
      : null;
    return {
      isPremium: true,
      canCancel: true,
      plan: latest.plan,
      planDetails: planDetails
        ? {
            id: planDetails.id,
            name: planDetails.name,
            color: planDetails.color,
            icon: planDetails.icon,
          }
        : null,
      startedAt: latest.startedAt,
      expiresAt: latest.expiresAt,
      daysRemaining: latest.expiresAt
        ? Math.max(0, Math.ceil((latest.expiresAt.getTime() - now) / DAY_MS))
        : null,
    };
  }

  /**
   * Cancels the user's paid subscription right away; the remaining days are
   * lost. Plans are bought one-off (no auto-renewal), so this is the only way
   * to end one early. No money is returned here: refunds go through the admin
   * payments screen.
   */
  async cancel(userId: string, reason?: string) {
    const subscription = await this.subscriptionsRepository.findOne({
      where: {
        userId,
        status: SubscriptionStatus.ACTIVE,
        plan: Not(SubscriptionPlan.FREE),
      },
      order: { createdAt: 'DESC' },
    });
    const now = new Date();
    if (
      !subscription ||
      (subscription.expiresAt &&
        subscription.expiresAt.getTime() <= now.getTime())
    ) {
      throw new BadRequestException('شما اشتراک فعالی ندارید');
    }

    await this.subscriptionsRepository.update(subscription.id, {
      status: SubscriptionStatus.INACTIVE,
      expiresAt: now,
      cancelledAt: now,
      cancelReason: reason?.trim() || null,
    });
    await this.notificationsService.notify(userId, {
      type: NotificationType.PAYMENT,
      title: 'اشتراک لغو شد',
      body: 'اشتراک ویژه شما لغو شد و دسترسی‌های ویژه غیرفعال است.',
      data: { subscriptionId: subscription.id },
      dedupeKey: `subscription-cancelled:${subscription.id}`,
    });
    return this.me(userId);
  }

  /** Creates a pending payment and returns where to send the payer. */
  async checkout(userId: string, dto: CheckoutDto) {
    const plan = await this.plansRepository.findOne({
      where: { id: dto.planId, isActive: true },
    });
    if (!plan) throw new NotFoundException('پلن یافت نشد');

    const months = dto.months ?? 1;
    const option = this.periodOptions(plan).find((o) => o.months === months);
    if (!option)
      throw new BadRequestException(
        'مدت اشتراک انتخاب‌شده برای این پلن مجاز نیست',
      );

    const payment = await this.paymentsRepository.save(
      this.paymentsRepository.create({
        userId,
        planId: plan.id,
        planMonths: months,
        purpose: PaymentPurpose.SUBSCRIPTION,
        amount: option.fullPrice,
        discount: option.fullPrice - option.totalPrice,
        gatewayFee: 0,
        finalAmount: option.totalPrice,
        method: PaymentMethod.ONLINE,
        status: PaymentStatus.PENDING,
        timeline: [this.entry('درخواست خرید اشتراک ایجاد شد')],
      }),
    );

    const callbackUrl = `${this.configService.get<string>('appUrl')}/api/v1/premium/callback?paymentId=${payment.id}`;
    try {
      const result = await this.gatewayService.initiate(dto.gateway, {
        paymentId: payment.id,
        amountToman: option.totalPrice,
        description: `اشتراک ${plan.name} - ${months} ماه`,
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
        amount: option.totalPrice,
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

  /** The gateway sends the payer back here; verify, then activate. */
  async handleCallback(
    paymentId: string,
    authority: string | undefined,
    status: string | undefined,
  ): Promise<CallbackResult> {
    const payment = await this.paymentsRepository.findOne({
      where: { id: paymentId },
    });
    if (!payment || payment.purpose !== PaymentPurpose.SUBSCRIPTION) {
      throw new NotFoundException('پرداخت یافت نشد');
    }
    if (payment.status === PaymentStatus.SUCCESS) {
      return { status: 'success', paymentId }; // Repeated callback.
    }
    if (payment.status !== PaymentStatus.PENDING) {
      return {
        status: 'failed',
        paymentId,
        message: 'این پرداخت دیگر قابل پیگیری نیست',
      };
    }
    if (!authority || authority !== payment.gatewayReference) {
      return this.fail(payment, 'شناسه پرداخت با درخواست مطابقت ندارد');
    }
    if (status !== 'OK') return this.fail(payment, 'پرداخت توسط کاربر لغو شد');

    const verification = await this.gatewayService.verify(
      payment.gateway ?? 'mock',
      {
        authority,
        amountToman: payment.finalAmount,
      },
    );
    if (!verification.success) {
      return this.fail(
        payment,
        verification.message ?? 'تایید پرداخت ناموفق بود',
      );
    }

    // Only one concurrent callback may flip pending → success.
    const activated = await this.dataSource.transaction(async (manager) => {
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
      await this.activateSubscription(manager, payment);
      return true;
    });

    if (activated) {
      await this.notificationsService.notify(payment.userId!, {
        type: NotificationType.PAYMENT,
        title: 'اشتراک فعال شد',
        body: 'پرداخت شما با موفقیت انجام شد و اشتراک ویژه فعال است.',
        data: { paymentId: payment.id },
        dedupeKey: `subscription-activated:${payment.id}`,
      });
    }
    return { status: 'success', paymentId };
  }

  async myPayments(userId: string) {
    const payments = await this.paymentsRepository.find({
      where: { userId, purpose: PaymentPurpose.SUBSCRIPTION },
      order: { createdAt: 'DESC' },
      take: 50,
    });
    return payments.map((p) => ({
      id: p.id,
      code: `TX-${p.number}`,
      status: p.status,
      amount: p.finalAmount,
      months: p.planMonths,
      gateway: p.gateway,
      paidAt: p.paidAt,
      createdAt: p.createdAt,
    }));
  }

  // ---- helpers ----

  /** 1 month at list price plus each configured period with its discount. */
  private periodOptions(plan: PremiumPlan) {
    const options = [
      { months: 1, discountPercent: 0 },
      ...plan.periods.filter((p) => p.months !== 1),
    ];
    return options.map((option) => {
      const fullPrice = plan.basePrice * option.months;
      const totalPrice = Math.round(
        fullPrice * (1 - option.discountPercent / 100),
      );
      return {
        months: option.months,
        discountPercent: option.discountPercent,
        fullPrice,
        totalPrice,
        monthlyPrice: Math.round(totalPrice / option.months),
      };
    });
  }

  private async activateSubscription(
    manager: DataSource['manager'],
    payment: Payment,
  ): Promise<void> {
    const userId = payment.userId!;
    const months = payment.planMonths ?? 1;
    const now = new Date();

    // Buying while subscribed extends from the current expiry.
    const current = await manager.findOne(Subscription, {
      where: { userId, status: SubscriptionStatus.ACTIVE },
      order: { createdAt: 'DESC' },
    });
    const start =
      current?.expiresAt && current.expiresAt.getTime() > now.getTime()
        ? current.expiresAt
        : now;

    await manager.update(
      Subscription,
      { userId, status: SubscriptionStatus.ACTIVE },
      { status: SubscriptionStatus.INACTIVE },
    );
    await manager.save(
      manager.create(Subscription, {
        userId,
        plan: months >= 12 ? SubscriptionPlan.YEARLY : SubscriptionPlan.MONTHLY,
        planId: payment.planId,
        status: SubscriptionStatus.ACTIVE,
        startedAt: now,
        expiresAt: addMonths(start, months),
      }),
    );
  }

  private async fail(
    payment: Payment,
    message: string,
  ): Promise<CallbackResult> {
    this.logger.warn(`Payment ${payment.id} failed: ${message}`);
    await this.paymentsRepository.update(
      { id: payment.id, status: PaymentStatus.PENDING },
      {
        status: PaymentStatus.FAILED,
        timeline: [...payment.timeline, this.entry(message)],
      },
    );
    return { status: 'failed', paymentId: payment.id, message };
  }

  private entry(message: string) {
    return { at: new Date().toISOString(), message };
  }
}
