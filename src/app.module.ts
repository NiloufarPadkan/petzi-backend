import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnvironment } from './config/environment.validation';
import { AuthModule } from './modules/auth/auth.module';
import { PetsModule } from './modules/pets/pets.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { UsersModule } from './modules/users/users.module';
import { SubscriptionsModule } from './modules/subscriptions/subscriptions.module';
import { User } from './modules/users/entities/user.entity';
import { Otp } from './modules/otp/entities/otp.entity';
import { Pet } from './modules/pets/entities/pet.entity';
import { PetVaccine } from './modules/pets/entities/pet-vaccine.entity';
import { PetDocument } from './modules/pets/entities/pet-document.entity';
import { Address } from './modules/addresses/entities/address.entity';
import { Subscription } from './modules/subscriptions/entities/subscription.entity';
import { UserNote } from './modules/users/entities/user-note.entity';
import { VetsModule } from './modules/vets/vets.module';
import { ClinicsModule } from './modules/clinics/clinics.module';
import { Clinic } from './modules/clinics/entities/clinic.entity';
import { ClinicServiceItem } from './modules/clinics/entities/clinic-service-item.entity';
import { ClinicWorkingHour } from './modules/clinics/entities/clinic-working-hour.entity';
import { ClinicImage } from './modules/clinics/entities/clinic-image.entity';
import { ClinicReview } from './modules/clinics/entities/clinic-review.entity';
import { ClinicLog } from './modules/clinics/entities/clinic-log.entity';
import { VetProfile } from './modules/vets/entities/vet-profile.entity';
import { VetDocument } from './modules/vets/entities/vet-document.entity';
import { VetClinicService } from './modules/vets/entities/vet-clinic-service.entity';
import { VetWorkingHour } from './modules/vets/entities/vet-working-hour.entity';
import { VetReview } from './modules/vets/entities/vet-review.entity';
import { VetStatusLog } from './modules/vets/entities/vet-status-log.entity';
import { OneTimeToken } from './modules/auth/entities/one-time-token.entity';
import { PremiumPlan } from './modules/plans/entities/premium-plan.entity';
import { SystemSetting } from './modules/settings/entities/system-setting.entity';
import { SupportTicket } from './modules/support/entities/support-ticket.entity';
import { FaqItem } from './modules/support/entities/faq-item.entity';
import { Conversation } from './modules/messages/entities/conversation.entity';
import { ChatMessage } from './modules/messages/entities/chat-message.entity';
import { Reservation } from './modules/reservations/entities/reservation.entity';
import { ReservationNote } from './modules/reservations/entities/reservation-note.entity';
import { ReservationEvent } from './modules/reservations/entities/reservation-event.entity';
import { Payment } from './modules/payments/entities/payment.entity';
import { Organization } from './modules/organizations/entities/organization.entity';
import { ClinicRole } from './modules/clinic-panel/entities/clinic-role.entity';
import { ClinicMember } from './modules/clinic-panel/entities/clinic-member.entity';
import { ClinicPatient } from './modules/clinic-panel/entities/clinic-patient.entity';
import { PatientRecord } from './modules/clinic-panel/entities/patient-record.entity';
import { FavoriteProvider } from './modules/providers/entities/favorite.entity';
import {
  PetWeight,
  PetEvent,
  PetMedication,
  PetSurgery,
} from './modules/pet-health/entities/pet-health.entities';
import {
  Notification,
  DeviceToken,
} from './modules/notifications/entities/notification.entities';
import { ProvidersModule } from './modules/providers/providers.module';
import { BookingsModule } from './modules/bookings/bookings.module';
import { PetHealthModule } from './modules/pet-health/pet-health.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PremiumModule } from './modules/premium/premium.module';
import { HomeModule } from './modules/home/home.module';
import { ClinicPanelModule } from './modules/clinic-panel/clinic-panel.module';
import { PlansModule } from './modules/plans/plans.module';
import { SettingsModule } from './modules/settings/settings.module';
import { SupportModule } from './modules/support/support.module';
import { MessagesModule } from './modules/messages/messages.module';
import { ReservationsModule } from './modules/reservations/reservations.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { OrganizationsModule } from './modules/organizations/organizations.module';
import { DashboardModule } from './modules/dashboard/dashboard.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [
          User,
          Otp,
          Pet,
          PetVaccine,
          PetDocument,
          Address,
          Subscription,
          UserNote,
          VetProfile,
          VetDocument,
          VetClinicService,
          VetWorkingHour,
          VetReview,
          VetStatusLog,
          Clinic,
          ClinicServiceItem,
          ClinicWorkingHour,
          ClinicImage,
          ClinicReview,
          ClinicLog,
          OneTimeToken,
          PremiumPlan,
          SystemSetting,
          SupportTicket,
          FaqItem,
          Conversation,
          ChatMessage,
          Reservation,
          ReservationNote,
          ReservationEvent,
          Payment,
          Organization,
          ClinicRole,
          ClinicMember,
          ClinicPatient,
          PatientRecord,
          FavoriteProvider,
          PetWeight,
          PetEvent,
          PetMedication,
          PetSurgery,
          Notification,
          DeviceToken,
        ],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<string>('nodeEnv') === 'development',
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    PetsModule,
    AddressesModule,
    UsersModule,
    SubscriptionsModule,
    VetsModule,
    ClinicsModule,
    PlansModule,
    SettingsModule,
    SupportModule,
    MessagesModule,
    ReservationsModule,
    PaymentsModule,
    OrganizationsModule,
    DashboardModule,
    ClinicPanelModule,
    ProvidersModule,
    BookingsModule,
    PetHealthModule,
    NotificationsModule,
    PremiumModule,
    HomeModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
