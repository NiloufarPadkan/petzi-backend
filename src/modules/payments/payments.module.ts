import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PremiumPlan } from '../plans/entities/premium-plan.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { User } from '../users/entities/user.entity';
import { AdminPaymentsController } from './admin-payments.controller';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Reservation, PremiumPlan, Clinic]),
  ],
  controllers: [AdminPaymentsController],
  providers: [PaymentsService],
})
export class PaymentsModule {}
