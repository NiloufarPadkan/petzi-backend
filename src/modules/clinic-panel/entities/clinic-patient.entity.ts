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

/**
 * A pet on a clinic's patient list. Pets that have a reservation at the clinic
 * are patients too; this row adds clinic-specific data and lets the clinic
 * add (or archive) patients explicitly.
 */
@Entity('clinic_patients')
@Index(['clinicId', 'petId'], { unique: true })
export class ClinicPatient {
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

  /** Primary vet for this patient. */
  @Column({ type: 'uuid', nullable: true })
  vetId: string | null;

  @ManyToOne(() => User, { nullable: true, onDelete: 'SET NULL' })
  @JoinColumn({ name: 'vetId' })
  vet: User | null;

  @Column({ type: 'timestamptz', default: () => 'now()' })
  firstVisitAt: Date;

  @Column({ type: 'text', nullable: true })
  medicalNotes: string | null;

  /** Hidden from the patient list when set. */
  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
