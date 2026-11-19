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
import { ReservationStatus } from '../../../common/enums/admin-panel.enums';
import { Pet } from '../../pets/entities/pet.entity';
import { User } from '../../users/entities/user.entity';

@Entity('reservations')
@Index(['ownerId'])
@Index(['vetId', 'scheduledAt'])
@Index(['clinicId', 'scheduledAt'])
@Index(['status', 'scheduledAt'])
export class Reservation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'int', update: false })
  @Generated('increment')
  number: number;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'uuid', nullable: true })
  petId: string | null;

  @ManyToOne(() => Pet, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'petId' })
  pet: Pet | null;

  /** Vet account (users.id of a `vet`). */
  @Column({ type: 'uuid', nullable: true })
  vetId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vetId' })
  vet: User | null;

  /** Clinic account (users.id of a `clinic`). */
  @Column({ type: 'uuid', nullable: true })
  clinicId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'clinicId' })
  clinic: User | null;

  @Column({ length: 150 })
  serviceName: string;

  @Column({ type: 'text', nullable: true })
  serviceDescription: string | null;

  @Column({ type: 'timestamptz' })
  scheduledAt: Date;

  @Column({ type: 'int', default: 30 })
  durationMinutes: number;

  @Column({
    type: 'enum',
    enum: ReservationStatus,
    default: ReservationStatus.PENDING,
  })
  status: ReservationStatus;

  /** Service price in Toman. */
  @Column({ type: 'int', default: 0 })
  price: number;

  @Column({ type: 'text', nullable: true })
  clinicNote: string | null;

  @Column({ type: 'text', nullable: true })
  cancelReason: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
