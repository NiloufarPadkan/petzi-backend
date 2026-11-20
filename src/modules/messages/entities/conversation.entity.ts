import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

/** One support conversation per user. */
@Entity('conversations')
@Index(['lastMessageAt'])
export class Conversation {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ unique: true })
  userId: string;

  @OneToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'timestamptz', nullable: true })
  lastMessageAt: Date | null;

  @Column({ type: 'varchar', length: 200, nullable: true })
  lastMessagePreview: string | null;

  @Column({ type: 'int', default: 0 })
  unreadByAdmin: number;

  /** Support replies the user has not opened yet. */
  @Column({ type: 'int', default: 0 })
  unreadByUser: number;

  @CreateDateColumn()
  createdAt: Date;
}
