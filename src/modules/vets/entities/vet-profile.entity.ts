import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { PersonGender } from '../../../common/enums/person-gender.enum';
import { VetCollaborationStatus } from '../../../common/enums/vet-collaboration-status.enum';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';

/** One-to-one with a `vet` user; the primary key is the user's id. */
@Entity('vet_profiles')
@Index(['verificationStatus'])
@Index(['city'])
@Index(['clinicId'])
export class VetProfile {
  @PrimaryColumn('uuid')
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  medicalCouncilNumber: string;

  @Column({ type: 'varchar', length: 10, nullable: true })
  nationalCode: string | null;

  @Column({ type: 'enum', enum: PersonGender, nullable: true })
  gender: PersonGender | null;

  @Column({ type: 'text', nullable: true })
  bio: string | null;

  @Column({ length: 100 })
  city: string;

  @Column({ length: 100 })
  primarySpecialty: string;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  subSpecialties: string[];

  @Column({ type: 'varchar', length: 100, nullable: true })
  highestDegree: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  university: string | null;

  @Column({ type: 'int', nullable: true })
  graduationYear: number | null;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  languages: string[];

  /** The registered clinic the vet works at, if any. */
  @Column({ type: 'uuid', nullable: true })
  clinicId: string | null;

  @ManyToOne(() => Clinic, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic | null;

  /** Free-text fallbacks for vets whose clinic is not registered. */
  @Column({ type: 'varchar', length: 150, nullable: true })
  clinicName: string | null;

  @Column({ type: 'varchar', length: 20, nullable: true })
  clinicPhone: string | null;

  @Column({ type: 'text', nullable: true })
  clinicAddress: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  instagram: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  telegram: string | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  linkedin: string | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  verificationStatus: ApprovalStatus;

  @Column({
    type: 'enum',
    enum: VetCollaborationStatus,
    default: VetCollaborationStatus.ACTIVE,
  })
  collaborationStatus: VetCollaborationStatus;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
