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

const migrationsExtension = __filename.endsWith('.ts') ? 'ts' : 'js';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST ?? 'localhost',
  port: parseInt(process.env.DB_PORT ?? '5432', 10),
  username: process.env.DB_USERNAME ?? 'postgres',
  password: process.env.DB_PASSWORD ?? 'postgres',
  database: process.env.DB_DATABASE ?? 'petzi',
  entities: [User, Otp, Pet, PetVaccine, PetDocument, Address, Subscription],
  migrations: [join(__dirname, '..', 'migrations', `*.${migrationsExtension}`)],
  synchronize: false,
});
