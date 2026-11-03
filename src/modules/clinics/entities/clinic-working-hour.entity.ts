import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { Clinic } from './clinic.entity';

/** `dayOfWeek` follows the Iranian week: 0 = Saturday … 6 = Friday. */
@Entity('clinic_working_hours')
@Unique(['clinicId', 'dayOfWeek'])
export class ClinicWorkingHour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ type: 'smallint' })
  dayOfWeek: number;

  @Column({ default: false })
  isActive: boolean;

  @Column({ default: false })
  morningEnabled: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  morningStart: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  morningEnd: string | null;

  @Column({ type: 'int', nullable: true })
  morningMaxAppointments: number | null;

  @Column({ default: false })
  eveningEnabled: boolean;

  @Column({ type: 'varchar', length: 5, nullable: true })
  eveningStart: string | null;

  @Column({ type: 'varchar', length: 5, nullable: true })
  eveningEnd: string | null;

  @Column({ type: 'int', nullable: true })
  eveningMaxAppointments: number | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
