import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { Subscription } from './entities/subscription.entity';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
  ) {}

  async findLatestByUserIds(
    userIds: string[],
  ): Promise<Map<string, Subscription>> {
    if (userIds.length === 0) return new Map();

    const subscriptions = await this.subscriptionsRepository
      .createQueryBuilder('subscription')
      .distinctOn(['subscription.userId'])
      .where('subscription.userId IN (:...userIds)', { userIds })
      .orderBy('subscription.userId')
      .addOrderBy('subscription.createdAt', 'DESC')
      .getMany();

    return new Map(subscriptions.map((s) => [s.userId, s]));
  }

  async updateLatest(
    userId: string,
    changes: { plan?: SubscriptionPlan; status?: SubscriptionStatus },
  ): Promise<void> {
    const [latest] = await this.subscriptionsRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
      take: 1,
    });

    if (latest) {
      await this.subscriptionsRepository.update(latest.id, changes);
      return;
    }

    const subscription = this.subscriptionsRepository.create({
      userId,
      plan: changes.plan ?? SubscriptionPlan.FREE,
      status: changes.status ?? SubscriptionStatus.ACTIVE,
    });
    await this.subscriptionsRepository.save(subscription);
  }
}
