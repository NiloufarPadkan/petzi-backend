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
import {
  PetEventType,
  SurgeryStatus,
} from '../../../common/enums/owner-app.enums';
import { Pet } from '../../pets/entities/pet.entity';

@Entity('pet_weights')
@Index(['petId', 'measuredAt'])
export class PetWeight {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ type: 'float' })
  weightKg: number;

  @Column({ type: 'date' })
  measuredAt: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;
}

@Entity('pet_events')
@Index(['petId', 'eventAt'])
export class PetEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({
    type: 'enum',
    enum: PetEventType,
    enumName: 'pet_events_type_enum',
  })
  type: PetEventType;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'text', nullable: true })
  note: string | null;

  @Column({ type: 'timestamptz' })
  eventAt: Date;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('pet_medications')
@Index(['petId', 'isActive'])
export class PetMedication {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'varchar', length: 100, nullable: true })
  dosage: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  frequency: string | null;

  @Column({ type: 'date' })
  startDate: string;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('pet_surgeries')
@Index(['petId', 'surgeryDate'])
export class PetSurgery {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column({ length: 150 })
  name: string;

  @Column({ type: 'date' })
  surgeryDate: string;

  @Column({ type: 'varchar', length: 150, nullable: true })
  vetName: string | null;

  @Column({ type: 'varchar', length: 150, nullable: true })
  clinicName: string | null;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({
    type: 'enum',
    enum: SurgeryStatus,
    enumName: 'pet_surgeries_status_enum',
    default: SurgeryStatus.DONE,
  })
  status: SurgeryStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
