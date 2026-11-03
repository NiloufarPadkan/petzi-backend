import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { ClinicImageCategory } from '../../../common/enums/clinic-enums';
import { Clinic } from './clinic.entity';

@Entity('clinic_images')
@Index(['clinicId', 'category'])
export class ClinicImage {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  clinicId: string;

  @ManyToOne(() => Clinic, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'clinicId' })
  clinic: Clinic;

  @Column({ length: 150 })
  title: string;

  @Column({ type: 'enum', enum: ClinicImageCategory })
  category: ClinicImageCategory;

  @Column()
  fileUrl: string;

  @CreateDateColumn()
  createdAt: Date;
}
