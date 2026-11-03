import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '../users/entities/user.entity';
import { Pet } from './entities/pet.entity';
import { PetVaccine } from './entities/pet-vaccine.entity';
import { PetDocument } from './entities/pet-document.entity';
import { AdminPetsController } from './admin-pets.controller';
import { PetsController } from './pets.controller';
import { PetsService } from './pets.service';

@Module({
  imports: [TypeOrmModule.forFeature([Pet, PetVaccine, PetDocument, User])],
  controllers: [PetsController, AdminPetsController],
  providers: [PetsService],
  exports: [PetsService],
})
export class PetsModule {}
