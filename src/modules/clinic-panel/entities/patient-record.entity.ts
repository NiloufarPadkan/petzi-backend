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
import { Clinic } from '../../clinics/entities/clinic.entity';
import { Pet } from '../../pets/entities/pet.entity';
import { User } from '../../users/entities/user.entity';

export interface Prescription {
  name: string;
  dosage: string | null;
  instructions: string | null;
}

/** A medical record (exam, scan, lab result...) a clinic keeps for a pet. */
@Entity('patient_records')
@Index(['clinicId', 'petId', 'recordedAt'])
export class PatientRecord {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ type: 'uuid', nullable: true })
  vetId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vetId' })
  vet: User | null;

  @Column({ type: 'varchar', length: 50, default: 'visit' })
  type: string;

  @Column({ length: 200 })
  title: string;

  @Column({ type: 'timestamptz' })
  recordedAt: Date;

  @Column({ type: 'text', nullable: true })
  result: string | null;

  /** Stored as provided; the backend does not generate summaries. */
  @Column({ type: 'text', nullable: true })
  aiSummary: string | null;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  images: string[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  prescriptions: Prescription[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
