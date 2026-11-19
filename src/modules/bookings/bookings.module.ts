import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicReview } from '../clinics/entities/clinic-review.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { NotificationsModule } from '../notifications/notifications.module';
import { Pet } from '../pets/entities/pet.entity';
import { ProvidersModule } from '../providers/providers.module';
import { ReservationEvent } from '../reservations/entities/reservation-event.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { VetReview } from '../vets/entities/vet-review.entity';
import { BookingsController } from './bookings.controller';
import { BookingsService } from './bookings.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      ReservationEvent,
      Pet,
      VetReview,
      ClinicReview,
      Clinic,
    ]),
    ProvidersModule,
    NotificationsModule,
  ],
  controllers: [BookingsController],
  providers: [BookingsService],
})
export class BookingsModule {}
