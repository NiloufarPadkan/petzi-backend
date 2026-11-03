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
import { Clinic } from './clinic.entity';

@Entity('clinic_services')
@Index(['clinicId'])
export class ClinicServiceItem {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ length: 150 })
  name: string;

  @Column({ length: 100 })
  category: string;

  /** Base price in tomans. */
  @Column({ type: 'int' })
  basePrice: number;

  @Column({ type: 'int' })
  durationMinutes: number;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
