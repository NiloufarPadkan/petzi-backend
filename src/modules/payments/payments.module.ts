import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { PremiumPlan } from '../plans/entities/premium-plan.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { SettingsModule } from '../settings/settings.module';
import { User } from '../users/entities/user.entity';
import { AdminPaymentsController } from './admin-payments.controller';
import { Payment } from './entities/payment.entity';
import { PaymentGatewayService } from './gateways/payment-gateway.service';
import { MockProvider } from './gateways/mock.provider';
import { ZarinpalProvider } from './gateways/zarinpal.provider';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Payment, User, Reservation, PremiumPlan, Clinic]),
    SettingsModule,
  ],
  controllers: [AdminPaymentsController],
  providers: [
    PaymentsService,
    PaymentGatewayService,
    ZarinpalProvider,
    MockProvider,
  ],
  exports: [PaymentGatewayService],
})
export class PaymentsModule {}
