import 'dotenv/config';
import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { User } from '../modules/users/entities/user.entity';
import { Otp } from '../modules/otp/entities/otp.entity';
import { Pet } from '../modules/pets/entities/pet.entity';
import { PetVaccine } from '../modules/pets/entities/pet-vaccine.entity';
import { PetDocument } from '../modules/pets/entities/pet-document.entity';
import { Address } from '../modules/addresses/entities/address.entity';
import { Subscription } from '../modules/subscriptions/entities/subscription.entity';
import { UserNote } from '../modules/users/entities/user-note.entity';
import { VetProfile } from '../modules/vets/entities/vet-profile.entity';
import { VetDocument } from '../modules/vets/entities/vet-document.entity';
import { VetClinicService } from '../modules/vets/entities/vet-clinic-service.entity';
import { VetWorkingHour } from '../modules/vets/entities/vet-working-hour.entity';
import { VetReview } from '../modules/vets/entities/vet-review.entity';
import { VetStatusLog } from '../modules/vets/entities/vet-status-log.entity';
import { Clinic } from '../modules/clinics/entities/clinic.entity';
import { ClinicServiceItem } from '../modules/clinics/entities/clinic-service-item.entity';
import { ClinicWorkingHour } from '../modules/clinics/entities/clinic-working-hour.entity';
import { ClinicImage } from '../modules/clinics/entities/clinic-image.entity';
import { ClinicReview } from '../modules/clinics/entities/clinic-review.entity';
import { ClinicLog } from '../modules/clinics/entities/clinic-log.entity';
import { OneTimeToken } from '../modules/auth/entities/one-time-token.entity';
import { PremiumPlan } from '../modules/plans/entities/premium-plan.entity';
import { SystemSetting } from '../modules/settings/entities/system-setting.entity';
import { SupportTicket } from '../modules/support/entities/support-ticket.entity';
import { FaqItem } from '../modules/support/entities/faq-item.entity';
import { Conversation } from '../modules/messages/entities/conversation.entity';
import { ChatMessage } from '../modules/messages/entities/chat-message.entity';
import { Reservation } from '../modules/reservations/entities/reservation.entity';
import { ReservationNote } from '../modules/reservations/entities/reservation-note.entity';
import { ReservationEvent } from '../modules/reservations/entities/reservation-event.entity';
import { Payment } from '../modules/payments/entities/payment.entity';
import { Organization } from '../modules/organizations/entities/organization.entity';
import { ClinicRole } from '../modules/clinic-panel/entities/clinic-role.entity';
import { ClinicMember } from '../modules/clinic-panel/entities/clinic-member.entity';
import { ClinicPatient } from '../modules/clinic-panel/entities/clinic-patient.entity';
import { PatientRecord } from '../modules/clinic-panel/entities/patient-record.entity';
import { FavoriteProvider } from '../modules/providers/entities/favorite.entity';
import {
  PetWeight,
  PetEvent,
  PetMedication,
  PetSurgery,
} from '../modules/pet-health/entities/pet-health.entities';
import {
  Notification,
  DeviceToken,
} from '../modules/notifications/entities/notification.entities';

const migrationsExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'petzi',
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
  migrations: [join(__dirname, '..', 'migrations', `*.${migrationsExtension}`)],
  synchronize: false,
});
