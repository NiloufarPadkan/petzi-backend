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
  ],
  migrations: [join(__dirname, '..', 'migrations', `*.${migrationsExtension}`)],
  synchronize: false,
});
