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

@Entity('pet_documents')
@Index(['petId'])
export class PetDocument {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  petId: string;

  @ManyToOne(() => Pet, (pet) => pet.documents, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'petId' })
  pet: Pet;

  @Column()
  originalName: string;

  @Column()
  fileUrl: string;

  @Column()
  mimeType: string;

  @Column({ type: 'int' })
  sizeBytes: number;

  @CreateDateColumn()
  createdAt: Date;
}
