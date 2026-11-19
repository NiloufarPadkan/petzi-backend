import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { AdminPlansController } from './admin-plans.controller';
import { PremiumPlan } from './entities/premium-plan.entity';
import { PlansService } from './plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([PremiumPlan, Subscription])],
  controllers: [AdminPlansController],
  providers: [PlansService],
})
export class PlansModule {}
