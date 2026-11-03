import {
  Column,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
  Unique,
  UpdateDateColumn,
} from 'typeorm';
import { VetProfile } from './vet-profile.entity';

/** `dayOfWeek` follows the Iranian week: 0 = Saturday … 6 = Friday. */
@Entity('vet_working_hours')
@Unique(['vetId', 'dayOfWeek'])
export class VetWorkingHour {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vetId: string;

  @ManyToOne(() => VetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vetId' })
  vet: VetProfile;

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
