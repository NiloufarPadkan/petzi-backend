import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
  Index,
} from 'typeorm';
import { PetType } from '../../../common/enums/pet-type.enum';
import { PetGender } from '../../../common/enums/pet-gender.enum';
import { ApproximateAge } from '../../../common/enums/approximate-age.enum';
import { HealthStatus } from '../../../common/enums/health-status.enum';
import { VaccinationStatus } from '../../../common/enums/vaccination-status.enum';
import { FoodType } from '../../../common/enums/food-type.enum';
import { MealsPerDay } from '../../../common/enums/meals-per-day.enum';
import { PetStatus } from '../../../common/enums/pet-status.enum';
import { User } from '../../users/entities/user.entity';
import { PetVaccine } from './pet-vaccine.entity';
import { PetDocument } from './pet-document.entity';

@Entity('pets')
@Index(['ownerId', 'status'])
export class Pet {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  ownerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'ownerId' })
  owner: User;

  @Column({ type: 'enum', enum: PetStatus, default: PetStatus.DRAFT })
  status: PetStatus;

  @Column({ nullable: true })
  name: string;

  @Column({ type: 'enum', enum: PetType, nullable: true })
  type: PetType;

  @Column({ nullable: true })
  breed: string;

  @Column({ type: 'enum', enum: PetGender, nullable: true })
  gender: PetGender;

  @Column({ type: 'date', nullable: true })
  birthDate: string | null;

  @Column({ type: 'enum', enum: ApproximateAge, nullable: true })
  approximateAge: ApproximateAge | null;

  @Column({ nullable: true })
  color: string;

  @Column({ type: 'text', nullable: true })
  appearanceFeatures: string;

  @Column({ type: 'float', nullable: true })
  weight: number;

  @Column({ type: 'float', nullable: true })
  height: number;

  @Column({ type: 'enum', enum: HealthStatus, nullable: true })
  healthStatus: HealthStatus;

  @Column({ type: 'text', nullable: true, default: 'None' })
  underlyingDiseases: string;

  @Column({ type: 'text', nullable: true, default: 'None' })
  allergies: string;

  @Column({ type: 'text', nullable: true, default: 'None' })
  medications: string;

  @Column({ type: 'text', nullable: true })
  healthNotes: string;

  @Column({ type: 'enum', enum: VaccinationStatus, nullable: true })
  vaccinationStatus: VaccinationStatus;

  @Column({ type: 'date', nullable: true })
  lastDewormingDate: string;

  @Column({ nullable: true })
  dewormingType: string;

  @Column({ type: 'enum', enum: FoodType, nullable: true })
  foodType: FoodType;

  @Column({ nullable: true })
  foodBrand: string;

  @Column({ type: 'enum', enum: MealsPerDay, nullable: true })
  mealsPerDay: MealsPerDay;

  @Column({ type: 'text', nullable: true, default: 'None' })
  foodSensitivities: string;

  @Column({ type: 'text', nullable: true, default: 'None' })
  surgeries: string;

  @Column({ type: 'text', nullable: true, default: 'None' })
  previousDiseases: string;

  @Column({ type: 'text', nullable: true, default: 'None' })
  hospitalizations: string;

  @Column({ type: 'text', nullable: true })
  additionalNotes: string;

  @OneToMany(() => PetVaccine, (vaccine) => vaccine.pet, { cascade: true })
  vaccines: PetVaccine[];

  @OneToMany(() => PetDocument, (document) => document.pet, { cascade: true })
  documents: PetDocument[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
