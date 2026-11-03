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
import { VetProfile } from './vet-profile.entity';

@Entity('vet_services')
@Index(['vetId'])
export class VetClinicService {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vetId: string;

  @ManyToOne(() => VetProfile, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'vetId' })
  vet: VetProfile;

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
