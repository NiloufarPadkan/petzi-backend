import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { VetStatusLogType } from '../../../common/enums/vet-status-log-type.enum';
import { User } from '../../users/entities/user.entity';
import { VetProfile } from './vet-profile.entity';

@Entity('vet_status_logs')
@Index(['vetId', 'createdAt'])
export class VetStatusLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vetId: string;

  @ManyToOne(() => VetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vetId' })
  vet: VetProfile;

  @Column({ type: 'enum', enum: VetStatusLogType })
  type: VetStatusLogType;

  /** The status the vet moved to (null for `account_created`). */
  @Column({ type: 'varchar', length: 50, nullable: true })
  status: string | null;

  @Column({ type: 'text', nullable: true })
  reason: string | null;

  /** Null when the change was made by the system. */
  @Column({ type: 'uuid', nullable: true })
  actorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'actorId' })
  actor: User | null;

  @CreateDateColumn()
  createdAt: Date;
}
