import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClinicMember } from '../clinic-panel/entities/clinic-member.entity';
import { ClinicImage } from '../clinics/entities/clinic-image.entity';
import { ClinicReview } from '../clinics/entities/clinic-review.entity';
import { ClinicServiceItem } from '../clinics/entities/clinic-service-item.entity';
import { ClinicWorkingHour } from '../clinics/entities/clinic-working-hour.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { VetClinicService } from '../vets/entities/vet-clinic-service.entity';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import { VetReview } from '../vets/entities/vet-review.entity';
import { VetWorkingHour } from '../vets/entities/vet-working-hour.entity';
import { AvailabilityService } from './availability.service';
import { FavoriteProvider } from './entities/favorite.entity';
import {
  FavoritesController,
  ProvidersController,
} from './providers.controller';
import { ProvidersService } from './providers.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VetProfile,
      VetWorkingHour,
      VetClinicService,
      VetReview,
      Clinic,
      ClinicWorkingHour,
      ClinicServiceItem,
      ClinicImage,
      ClinicReview,
      ClinicMember,
      FavoriteProvider,
      Reservation,
    ]),
  ],
  controllers: [ProvidersController, FavoritesController],
  providers: [AvailabilityService, ProvidersService],
  exports: [AvailabilityService, ProvidersService],
})
export class ProvidersModule {}
