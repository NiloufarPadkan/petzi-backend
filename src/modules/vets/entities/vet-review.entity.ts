import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { User } from '../../users/entities/user.entity';
import { VetProfile } from './vet-profile.entity';

@Entity('vet_reviews')
@Index(['vetId', 'status'])
export class VetReview {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vetId: string;

  @ManyToOne(() => VetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vetId' })
  vet: VetProfile;

  @Column({ type: 'uuid', nullable: true })
  authorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'authorId' })
  author: User | null;

  @Column({ type: 'smallint' })
  rating: number;

  @Column({ type: 'text' })
  comment: string;

  @Column({ type: 'text', nullable: true })
  reply: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  repliedAt: Date | null;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
