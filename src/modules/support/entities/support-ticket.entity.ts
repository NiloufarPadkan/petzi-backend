import {
  Column,
  CreateDateColumn,
  Entity,
  Generated,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';
import {
  TicketPriority,
  TicketStatus,
} from '../../../common/enums/admin-panel.enums';
import { User } from '../../users/entities/user.entity';

export interface TicketAttachment {
  url: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

@Entity('support_tickets')
@Index(['status'])
@Index(['creatorId'])
export class SupportTicket {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', update: false })
  @Generated('increment')
  number: number;

  @Column({ type: 'uuid', nullable: true })
  creatorId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'creatorId' })
  creator: User | null;

  @Column({ length: 200 })
  subject: string;

  @Column({ type: 'varchar', length: 100, default: 'general' })
  category: string;

  @Column({ type: 'text' })
  description: string;

  @Column({
    type: 'enum',
    enum: TicketPriority,
    default: TicketPriority.NORMAL,
  })
  priority: TicketPriority;

  @Column({ type: 'enum', enum: TicketStatus, default: TicketStatus.OPEN })
  status: TicketStatus;

  /** Screenshots or photos the reporter added (images only). */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  attachments: TicketAttachment[];

  @Column({ type: 'text', nullable: true })
  adminResponse: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  resolvedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
