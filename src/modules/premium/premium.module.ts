import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsModule } from '../notifications/notifications.module';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { PremiumPlan } from '../plans/entities/premium-plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { PremiumController } from './premium.controller';
import { PremiumService } from './premium.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([PremiumPlan, Subscription, Payment]),
    PaymentsModule,
    NotificationsModule,
  ],
  controllers: [PremiumController],
  providers: [PremiumService],
})
export class PremiumModule {}
