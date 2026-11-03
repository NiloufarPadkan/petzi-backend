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
import { VetProfile } from './vet-profile.entity';

@Entity('vet_documents')
@Index(['vetId'])
export class VetDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vetId: string;

  @ManyToOne(() => VetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vetId' })
  vet: VetProfile;

  @Column({ length: 150 })
  title: string;

  @Column()
  originalName: string;

  @Column()
  fileUrl: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @Column({
    type: 'enum',
    enum: ApprovalStatus,
    default: ApprovalStatus.PENDING,
  })
  status: ApprovalStatus;

  @Column({ type: 'text', nullable: true })
  rejectionReason: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
