import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PetDocument } from '../pets/entities/pet-document.entity';
import { PetVaccine } from '../pets/entities/pet-vaccine.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import {
  PetEvent,
  PetMedication,
  PetSurgery,
  PetWeight,
} from './entities/pet-health.entities';
import { PetHealthController } from './pet-health.controller';
import { PetHealthService } from './pet-health.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Pet,
      PetVaccine,
      PetDocument,
      PetWeight,
      PetEvent,
      PetMedication,
      PetSurgery,
      Reservation,
    ]),
  ],
  controllers: [PetHealthController],
  providers: [PetHealthService],
  exports: [PetHealthService],
})
export class PetHealthModule {}
