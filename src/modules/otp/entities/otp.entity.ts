import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';
import { OtpPurpose } from '../../../common/enums/otp-purpose.enum';

@Entity('otps')
@Index(['phoneNumber', 'purpose', 'isUsed'])
export class Otp {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  phoneNumber: string;

  @Column({ length: 64 })
  codeHash: string;

  @Column({ type: 'enum', enum: OtpPurpose })
  purpose: OtpPurpose;

  @Column()
  expiresAt: Date;

  @Column({ default: false })
  isUsed: boolean;

  @Column({ type: 'smallint', default: 0 })
  failedAttempts: number;

  @CreateDateColumn()
  createdAt: Date;
}
