import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from '../../clinics/entities/clinic.entity';
import { User } from '../../users/entities/user.entity';
import { ClinicMemberType, MemberWorkingDay } from '../clinic-panel.constants';
import { ClinicRole } from './clinic-role.entity';

/**
 * A person working at a clinic (other than the manager account). A user can
 * belong to at most one clinic.
 */
@Entity('clinic_members')
@Index(['clinicId'])
export class ClinicMember {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'uuid', nullable: true })
  roleId: string | null;

  @ManyToOne(() => ClinicRole, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'roleId' })
  role: ClinicRole | null;

  @Column({
    type: 'enum',
    enum: ClinicMemberType,
    enumName: 'clinic_members_membertype_enum',
  })
  memberType: ClinicMemberType;

  @Column({ type: 'varchar', length: 100, nullable: true })
  jobTitle: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  workingHours: MemberWorkingDay[];

  /** ClinicServiceItem ids this member provides. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  serviceIds: string[];

  @Column({ type: 'timestamptz', default: () => 'now()' })
  joinedAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
