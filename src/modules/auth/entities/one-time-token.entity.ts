import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { OneTimeTokenPurpose } from '../../../common/enums/one-time-token-purpose.enum';

@Entity('one_time_tokens')
@Index(['jti'], { unique: true })
export class OneTimeToken {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 64 })
  jti: string;

  @Column({ type: 'enum', enum: OneTimeTokenPurpose })
  purpose: OneTimeTokenPurpose;

  @Column({ type: 'varchar', nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'uuid', nullable: true })
  userId: string | null;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @CreateDateColumn()
  createdAt: Date;
}
