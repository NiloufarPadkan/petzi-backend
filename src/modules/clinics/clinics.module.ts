import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import { AdminClinicImagesController } from './admin-clinic-images.controller';
import { AdminClinicReviewsController } from './admin-clinic-reviews.controller';
import { AdminClinicServicesController } from './admin-clinic-services.controller';
import { AdminClinicWorkingHoursController } from './admin-clinic-working-hours.controller';
import { AdminClinicsController } from './admin-clinics.controller';
import { ClinicImagesService } from './clinic-images.service';
import { ClinicReviewsService } from './clinic-reviews.service';
import { ClinicServicesService } from './clinic-services.service';
import { ClinicWorkingHoursService } from './clinic-working-hours.service';
import { ClinicsService } from './clinics.service';
import { ClinicImage } from './entities/clinic-image.entity';
import { ClinicLog } from './entities/clinic-log.entity';
import { ClinicReview } from './entities/clinic-review.entity';
import { ClinicServiceItem } from './entities/clinic-service-item.entity';
import { ClinicWorkingHour } from './entities/clinic-working-hour.entity';
import { Clinic } from './entities/clinic.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Clinic,
      ClinicServiceItem,
      ClinicWorkingHour,
      ClinicImage,
      ClinicReview,
      ClinicLog,
      VetProfile,
    ]),
    UsersModule,
  ],
  controllers: [
    AdminClinicsController,
    AdminClinicServicesController,
    AdminClinicWorkingHoursController,
    AdminClinicImagesController,
    AdminClinicReviewsController,
  ],
  providers: [
    ClinicsService,
    ClinicServicesService,
    ClinicWorkingHoursService,
    ClinicImagesService,
    ClinicReviewsService,
  ],
  exports: [ClinicsService],
})
export class ClinicsModule {}
