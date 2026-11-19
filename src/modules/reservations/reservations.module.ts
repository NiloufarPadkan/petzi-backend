import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Pet } from '../pets/entities/pet.entity';
import { User } from '../users/entities/user.entity';
import { AdminReservationsController } from './admin-reservations.controller';
import { ReservationEvent } from './entities/reservation-event.entity';
import { ReservationNote } from './entities/reservation-note.entity';
import { Reservation } from './entities/reservation.entity';
import { ReservationsService } from './reservations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Reservation,
      ReservationNote,
      ReservationEvent,
      User,
      Pet,
      Clinic,
    ]),
  ],
  controllers: [AdminReservationsController],
  providers: [ReservationsService],
  exports: [ReservationsService],
})
export class ReservationsModule {}
