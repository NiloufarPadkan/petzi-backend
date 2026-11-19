import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { OrganizationKind } from '../../../common/enums/admin-panel.enums';
import {
  ClinicActivityStatus,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { User } from '../../users/entities/user.entity';

export interface OrganizationShift {
  dayOfWeek: number;
  opensAt: string;
  closesAt: string;
  isClosed: boolean;
}

export interface ShelterAnimal {
  id: string;
  name: string;
  species: string;
  age: string | null;
  gender: string | null;
  description: string | null;
  photoUrl: string | null;
  isAdopted: boolean;
}

export interface OrganizationService {
  id: string;
  name: string;
  description: string | null;
}

/**
 * Petshops and shelters share one table; `kind` tells them apart.
 * One-to-one with a `petshop` / `shelter` user; the key is the user's id.
 */
@Entity('organizations')
@Index(['kind', 'verificationStatus'])
@Index(['kind', 'city'])
export class Organization {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: OrganizationKind,
    enumName: 'organizations_kind_enum',
  })
  kind: OrganizationKind;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'text', nullable: true })
  about: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  licenseNumber: string | null;

  @Column({ length: 20 })
  phone: string;

  @Column({ type: 'varchar', length: 20, nullable: true })
  secondaryPhone: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  website: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  instagram: string | null;

  @Column({ length: 100 })
  province: string;

  @Column({ length: 100 })
  city: string;

  @Column({ type: 'text' })
  address: string;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  latitude: string | null;

  @Column({ type: 'numeric', precision: 10, scale: 7, nullable: true })
  longitude: string | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  photos: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  shifts: OrganizationShift[];

  /** Petshop product categories. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  categories: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  services: OrganizationService[];

  /** Shelter animals. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  animals: ShelterAnimal[];

  @Column({ type: 'int', nullable: true })
  capacity: number | null;

  @Column({
    type: 'enum',
    enum: ClinicVerificationStatus,
    enumName: 'organizations_verificationstatus_enum',
    default: ClinicVerificationStatus.PENDING,
  })
  verificationStatus: ClinicVerificationStatus;

  @Column({
    type: 'enum',
    enum: ClinicActivityStatus,
    enumName: 'organizations_activitystatus_enum',
    default: ClinicActivityStatus.ACTIVE,
  })
  activityStatus: ClinicActivityStatus;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
