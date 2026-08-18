import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Pet } from './pet.entity';

@Entity('pet_vaccines')
@Index(['petId'])
export class PetVaccine {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, (pet) => pet.vaccines, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  vaccineName: string;

  @Column({ type: 'date' })
  vaccineDate: string;

  @CreateDateColumn()
  createdAt: Date;
}
