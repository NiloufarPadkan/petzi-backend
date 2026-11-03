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
import {
  ClinicActivityStatus,
  ClinicType,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { User } from '../../users/entities/user.entity';

const decimalToNumber = {
  to: (value: number | null) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};

/**
 * One-to-one with a `clinic` user (the clinic's sign-in account, whose
 * `fullName` is the manager's name); the primary key is the user's id.
 */
@Entity('clinics')
@Index(['verificationStatus'])
@Index(['city'])
export class Clinic {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'enum', enum: ClinicType })
  type: ClinicType;

  @Column({ type: 'text', nullable: true })
  about: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  licenseNumber: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  registrationNumber: string | null;

  @Column({ type: 'date', nullable: true })
  foundedAt: string | null;

  @Column({ type: 'varchar', length: 7, nullable: true })
  brandColor: string | null;

  @Column({ type: 'int', default: 0 })
  staffCount: number;

  @Column({ type: 'varchar', length: 20 })
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

  @Column({ type: 'varchar', length: 10, nullable: true })
  postalCode: string | null;

  @Column({ type: 'text' })
  address: string;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalToNumber,
  })
  latitude: number | null;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 7,
    nullable: true,
    transformer: decimalToNumber,
  })
  longitude: number | null;

  @Column({ type: 'varchar', nullable: true })
  logoUrl: string | null;

  @Column({ type: 'varchar', nullable: true })
  coverImageUrl: string | null;

  @Column({ default: true })
  acceptsOnlineBooking: boolean;

  @Column({ default: true })
  isListedInSearch: boolean;

  /** Online bookings close this many hours before the appointment. */
  @Column({ type: 'int', default: 2 })
  bookingCutoffHours: number;

  @Column({
    type: 'enum',
    enum: ClinicVerificationStatus,
    default: ClinicVerificationStatus.PENDING,
  })
  verificationStatus: ClinicVerificationStatus;

  @Column({
    type: 'enum',
    enum: ClinicActivityStatus,
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
