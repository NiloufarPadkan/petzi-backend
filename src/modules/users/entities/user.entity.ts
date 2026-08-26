import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';
import { UserRole } from '../../../common/enums/user-role.enum';

export interface NotificationPreferences {
  newsletter: boolean;
  reservationAlerts: boolean;
  messageAlerts: boolean;
}

export const DEFAULT_NOTIFICATION_PREFERENCES: NotificationPreferences = {
  newsletter: false,
  reservationAlerts: true,
  messageAlerts: true,
};

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true, nullable: true })
  username: string;

  @Column({ unique: true })
  phoneNumber: string;

  @Column({ nullable: true })
  fullName: string;

  @Column({ unique: true, nullable: true })
  email: string;

  @Column({ type: 'date', nullable: true })
  dateOfBirth: string;

  @Column({ nullable: true, select: false })
  password: string;

  @Column({ nullable: true })
  profilePictureUrl: string;

  @Column({ unique: true, nullable: true })
  googleId: string;

  @Column({ default: false })
  isPhoneVerified: boolean;

  @Column({ default: false })
  isEmailVerified: boolean;

  @Column({ type: 'enum', enum: UserRole, default: UserRole.USER })
  role: UserRole;

  @Column({ type: 'jsonb', default: DEFAULT_NOTIFICATION_PREFERENCES })
  notificationPreferences: NotificationPreferences;

  @Column({ type: 'text', nullable: true })
  statusChangeReason: string | null;

  @Column({ type: 'text', nullable: true })
  adminNotes: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
