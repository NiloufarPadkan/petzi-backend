import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
} from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn('uuid')
  id: string;

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

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn()
  deletedAt: Date | null;
}
