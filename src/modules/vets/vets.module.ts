import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import { AdminVetDocumentsController } from './admin-vet-documents.controller';
import { AdminVetReviewsController } from './admin-vet-reviews.controller';
import { AdminVetServicesController } from './admin-vet-services.controller';
import { AdminVetWorkingHoursController } from './admin-vet-working-hours.controller';
import { AdminVetsController } from './admin-vets.controller';
import { VetClinicService } from './entities/vet-clinic-service.entity';
import { VetDocument } from './entities/vet-document.entity';
import { VetProfile } from './entities/vet-profile.entity';
import { VetReview } from './entities/vet-review.entity';
import { VetStatusLog } from './entities/vet-status-log.entity';
import { VetWorkingHour } from './entities/vet-working-hour.entity';
import { VetClinicServicesService } from './vet-clinic-services.service';
import { VetDocumentsService } from './vet-documents.service';
import { VetReviewsService } from './vet-reviews.service';
import { VetWorkingHoursService } from './vet-working-hours.service';
import { VetsService } from './vets.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      VetProfile,
      VetDocument,
      VetClinicService,
      VetWorkingHour,
      VetReview,
      VetStatusLog,
    ]),
    UsersModule,
  ],
  controllers: [
    AdminVetsController,
    AdminVetDocumentsController,
    AdminVetServicesController,
    AdminVetWorkingHoursController,
    AdminVetReviewsController,
  ],
  providers: [
    VetsService,
    VetDocumentsService,
    VetClinicServicesService,
    VetWorkingHoursService,
    VetReviewsService,
  ],
})
export class VetsModule {}
