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

@Entity('clinic_roles')
@Index(['clinicId', 'name'], { unique: true })
export class ClinicRole {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  /** ClinicPermission values. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  permissions: string[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
