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
  PaymentMethod,
  PaymentPurpose,
  PaymentStatus,
} from '../../../common/enums/admin-panel.enums';
import { Reservation } from '../../reservations/entities/reservation.entity';
import { User } from '../../users/entities/user.entity';

export interface PaymentTimelineEntry {
  at: string;
  message: string;
}

@Entity('payments')
@Index(['userId'])
@Index(['reservationId'])
@Index(['status', 'createdAt'])
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', update: false })
  @Generated('increment')
  number: number;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'userId' })
  user: User | null;

  @Column({ type: 'uuid', nullable: true })
  reservationId: string | null;

  @ManyToOne(() => Reservation, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'reservationId' })
  reservation: Reservation | null;

  @Column({ type: 'uuid', nullable: true })
  planId: string | null;

  @Column({
    type: 'enum',
    enum: PaymentPurpose,
    default: PaymentPurpose.RESERVATION,
  })
  purpose: PaymentPurpose;

  /** All amounts are in Toman. */
  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int', default: 0 })
  discount: number;

  @Column({ type: 'int', default: 0 })
  gatewayFee: number;

  /** amount - discount + gatewayFee */
  @Column({ type: 'int' })
  finalAmount: number;

  @Column({ type: 'enum', enum: PaymentMethod, default: PaymentMethod.ONLINE })
  method: PaymentMethod;

  @Column({ type: 'varchar', length: 50, nullable: true })
  gateway: string | null;

  @Column({
    type: 'enum',
    enum: PaymentStatus,
    default: PaymentStatus.PENDING,
  })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 100, nullable: true })
  gatewayReference: string | null;

  /** Retrieval reference number. */
  @Column({ type: 'varchar', length: 100, nullable: true })
  rrn: string | null;

  @Column({ default: false })
  isSettled: boolean;

  @Column({ type: 'timestamptz', nullable: true })
  paidAt: Date | null;

  @Column({ type: 'int', default: 0 })
  refundedAmount: number;

  @Column({ type: 'timestamptz', nullable: true })
  refundedAt: Date | null;

  @Column({ type: 'text', nullable: true })
  refundReason: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  timeline: PaymentTimelineEntry[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
