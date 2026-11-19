import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import {
  DevicePlatform,
  NotificationType,
} from '../../../common/enums/owner-app.enums';
import { User } from '../../users/entities/user.entity';

@Entity('notifications')
@Index(['userId', 'createdAt'])
@Index(['userId', 'dedupeKey'], { unique: true })
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: NotificationType,
    enumName: 'notifications_type_enum',
  })
  type: NotificationType;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'text' })
  body: string;

  /** Ids the app needs to open the right screen (reservationId, petId…). */
  @Column({ type: 'jsonb', default: () => "'{}'" })
  data: Record<string, string>;

  /**
   * Makes a notification idempotent: generating the same reminder twice (or
   * from two server instances) inserts only one row.
   */
  @Column({ type: 'varchar', length: 200, nullable: true })
  dedupeKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  readAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('device_tokens')
export class DeviceToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  @Index()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ unique: true })
  token: string;

  @Column({
    type: 'enum',
    enum: DevicePlatform,
    enumName: 'device_tokens_platform_enum',
  })
  platform: DevicePlatform;

  @CreateDateColumn()
  createdAt: Date;
}
