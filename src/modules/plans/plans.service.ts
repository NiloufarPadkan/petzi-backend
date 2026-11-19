import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import {
  PaymentPurpose,
  PaymentStatus,
} from '../../common/enums/admin-panel.enums';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { Payment } from '../payments/entities/payment.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import {
  CreatePlanDto,
  PlanResponseDto,
  PlansOverviewDto,
  PlanStatsDto,
  QueryPlansDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { PremiumPlan } from './entities/premium-plan.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class PlansService {
  constructor(
    @InjectRepository(PremiumPlan)
    private readonly plansRepository: Repository<PremiumPlan>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(query: QueryPlansDto): Promise<PlanResponseDto[]> {
    const plans = await this.plansRepository.find({
      where: query.isActive === undefined ? {} : { isActive: query.isActive },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    const stats = await this.getStats(plans.map((plan) => plan.id));
    return plans.map((plan) => this.toResponse(plan, stats.get(plan.id)));
  }

  async findOne(id: string): Promise<PlanResponseDto> {
    const plan = await this.getPlanOrThrow(id);
    const stats = await this.getStats([id]);
    return this.toResponse(plan, stats.get(id));
  }

  async create(dto: CreatePlanDto): Promise<PlanResponseDto> {
    const plan = await this.plansRepository.save(
      this.plansRepository.create({
        ...dto,
        periods: this.normalizePeriods(dto.periods),
      }),
    );
    return this.findOne(plan.id);
  }

  async update(id: string, dto: UpdatePlanDto): Promise<PlanResponseDto> {
    const plan = await this.getPlanOrThrow(id);
    const { periods, ...rest } = dto;
    Object.assign(plan, rest);
    if (periods !== undefined) plan.periods = this.normalizePeriods(periods);
    await this.plansRepository.save(plan);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const plan = await this.getPlanOrThrow(id);
    const stats = await this.getStats([id]);
    if ((stats.get(id)?.activeSubscribers ?? 0) > 0) {
      throw new ConflictException(
        'این پلن مشترک فعال دارد؛ ابتدا آن را غیرفعال کنید',
      );
    }
    await this.plansRepository.remove(plan);
  }

  async getOverview(): Promise<PlansOverviewDto> {
    const now = Date.now();
    const since = new Date(now - 30 * DAY_MS);
    const previousSince = new Date(now - 60 * DAY_MS);

    const paidActive = this.subscriptionsRepository
      .createQueryBuilder('sub')
      .where('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('sub.plan != :free', { free: SubscriptionPlan.FREE });

    const [activeSubscriptions, newSubscriptions] = await Promise.all([
      paidActive.clone().getCount(),
      paidActive
        .clone()
        .andWhere('sub.createdAt >= :since', { since })
        .getCount(),
    ]);

    const revenue = (from: Date, to: Date) =>
      this.dataSource
        .getRepository(Payment)
        .createQueryBuilder('p')
        .select('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'sum')
        .where('p.purpose = :purpose', { purpose: PaymentPurpose.SUBSCRIPTION })
        .andWhere('p.status IN (:...statuses)', {
          statuses: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED],
        })
        .andWhere('p.paidAt >= :from AND p.paidAt < :to', { from, to })
        .getRawOne<{ sum: string }>()
        .then((row) => Number(row?.sum ?? 0));

    const [monthlyRevenue, previousRevenue] = await Promise.all([
      revenue(since, new Date(now + DAY_MS)),
      revenue(previousSince, since),
    ]);

    const plans = await this.plansRepository.find();
    const stats = await this.getStats(plans.map((plan) => plan.id));
    let popular: PlansOverviewDto['mostPopularPlan'] = null;
    for (const plan of plans) {
      const subscribers = stats.get(plan.id)?.activeSubscribers ?? 0;
      if (subscribers > (popular?.subscribers ?? 0)) {
        popular = {
          id: plan.id,
          name: plan.name,
          subscribers,
          sharePercent: activeSubscriptions
            ? Math.round((subscribers / activeSubscriptions) * 100)
            : 0,
        };
      }
    }

    return {
      activeSubscriptions,
      newSubscriptions,
      monthlyRevenue,
      revenueChangePercent: previousRevenue
        ? Math.round(
            ((monthlyRevenue - previousRevenue) / previousRevenue) * 1000,
          ) / 10
        : null,
      mostPopularPlan: popular,
    };
  }

  private async getPlanOrThrow(id: string): Promise<PremiumPlan> {
    const plan = await this.plansRepository.findOne({ where: { id } });
    if (!plan) throw new NotFoundException('پلن یافت نشد');
    return plan;
  }

  private normalizePeriods(
    periods?: { months: number; discountPercent: number }[],
  ) {
    const unique = new Map<
      number,
      { months: number; discountPercent: number }
    >();
    for (const period of periods ?? []) {
      unique.set(period.months, {
        months: period.months,
        discountPercent: period.discountPercent,
      });
    }
    return [...unique.values()].sort((a, b) => a.months - b.months);
  }

  private async getStats(ids: string[]): Promise<Map<string, PlanStatsDto>> {
    const result = new Map<string, PlanStatsDto>();
    if (ids.length === 0) return result;
    for (const id of ids) {
      result.set(id, { activeSubscribers: 0, monthlyRevenue: 0 });
    }

    const subscribers = await this.subscriptionsRepository
      .createQueryBuilder('sub')
      .select('sub.planId', 'planId')
      .addSelect('COUNT(*)', 'count')
      .where('sub.planId IN (:...ids)', { ids })
      .andWhere('sub.status = :status', { status: SubscriptionStatus.ACTIVE })
      .groupBy('sub.planId')
      .getRawMany<{ planId: string; count: string }>();
    for (const row of subscribers) {
      const stats = result.get(row.planId);
      if (stats) stats.activeSubscribers = Number(row.count);
    }

    const revenue = await this.dataSource
      .getRepository(Payment)
      .createQueryBuilder('p')
      .select('p.planId', 'planId')
      .addSelect('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'sum')
      .where({ planId: In(ids) })
      .andWhere('p.status IN (:...statuses)', {
        statuses: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED],
      })
      .andWhere('p.paidAt >= :since', {
        since: new Date(Date.now() - 30 * DAY_MS),
      })
      .groupBy('p.planId')
      .getRawMany<{ planId: string; sum: string }>();
    for (const row of revenue) {
      const stats = result.get(row.planId);
      if (stats) stats.monthlyRevenue = Number(row.sum);
    }
    return result;
  }

  private toResponse(plan: PremiumPlan, stats?: PlanStatsDto): PlanResponseDto {
    return {
      id: plan.id,
      name: plan.name,
      description: plan.description,
      isActive: plan.isActive,
      color: plan.color,
      icon: plan.icon,
      badge: plan.badge,
      basePrice: plan.basePrice,
      periods: plan.periods,
      features: plan.features,
      sortOrder: plan.sortOrder,
      stats: stats ?? { activeSubscribers: 0, monthlyRevenue: 0 },
      createdAt: plan.createdAt,
      updatedAt: plan.updatedAt,
    };
  }
}
