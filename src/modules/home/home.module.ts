import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Notification } from '../notifications/entities/notification.entities';
import {
  PetMedication,
  PetWeight,
} from '../pet-health/entities/pet-health.entities';
import { PetHealthModule } from '../pet-health/pet-health.module';
import { PetVaccine } from '../pets/entities/pet-vaccine.entity';
import { Pet } from '../pets/entities/pet.entity';
import { ProvidersModule } from '../providers/providers.module';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { HomeController } from './home.controller';
import { HomeService } from './home.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      PetVaccine,
      PetMedication,
      PetWeight,
      Reservation,
      Subscription,
      Notification,
    ]),
    PetHealthModule,
    ProvidersModule,
  ],
  controllers: [HomeController],
  providers: [HomeService],
})
export class HomeModule {}
