import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClinicLogType } from '../../../common/enums/clinic-enums';
import { User } from '../../users/entities/user.entity';
import { Clinic } from './clinic.entity';

/** Status changes and schedule edits, newest first in the admin panel. */
@Entity('clinic_logs')
@Index(['clinicId', 'createdAt'])
export class ClinicLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ type: 'enum', enum: ClinicLogType })
  type: ClinicLogType;

  /** The status the clinic moved to (null for other log types). */
  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string | null;

  /** Reason for a status change, or a description of a schedule edit. */
  @Column({ type: 'text', nullable: true })
  reason: string | null;

  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
