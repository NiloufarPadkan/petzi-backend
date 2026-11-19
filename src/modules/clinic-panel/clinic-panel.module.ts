import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { ClinicsModule } from '../clinics/clinics.module';
import { ClinicServiceItem } from '../clinics/entities/clinic-service-item.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { ReservationsModule } from '../reservations/reservations.module';
import { User } from '../users/entities/user.entity';
import { UsersModule } from '../users/users.module';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import {
  ClinicPatientsController,
  ClinicReservationsController,
} from './care.controllers';
import { ClinicAnalyticsService } from './clinic-analytics.service';
import { ClinicPanelGuard } from './clinic-panel.guard';
import { ClinicPatientsService } from './clinic-patients.service';
import { ClinicProfileService } from './clinic-profile.service';
import { ClinicRegistrationService } from './clinic-registration.service';
import { ClinicReservationsService } from './clinic-reservations.service';
import { ClinicTeamService } from './clinic-team.service';
import { ClinicMember } from './entities/clinic-member.entity';
import { ClinicPatient } from './entities/clinic-patient.entity';
import { ClinicRole } from './entities/clinic-role.entity';
import { PatientRecord } from './entities/patient-record.entity';
import {
  ClinicDashboardController,
  ClinicRegistrationController,
  ClinicReportsController,
} from './insights.controllers';
import {
  ClinicProfileController,
  ClinicServicesController,
  ClinicWorkingHoursController,
} from './settings.controllers';
import {
  ClinicRolesController,
  ClinicTeamController,
} from './team.controllers';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ClinicMember,
      ClinicRole,
      ClinicPatient,
      PatientRecord,
      Clinic,
      ClinicServiceItem,
      Reservation,
      Pet,
      User,
      VetProfile,
    ]),
    AuthModule,
    ClinicsModule,
    ReservationsModule,
    UsersModule,
  ],
  controllers: [
    ClinicDashboardController,
    ClinicReservationsController,
    ClinicPatientsController,
    ClinicTeamController,
    ClinicRolesController,
    ClinicProfileController,
    ClinicServicesController,
    ClinicWorkingHoursController,
    ClinicReportsController,
    ClinicRegistrationController,
  ],
  providers: [
    ClinicPanelGuard,
    ClinicTeamService,
    ClinicReservationsService,
    ClinicPatientsService,
    ClinicProfileService,
    ClinicAnalyticsService,
    ClinicRegistrationService,
  ],
})
export class ClinicPanelModule {}
