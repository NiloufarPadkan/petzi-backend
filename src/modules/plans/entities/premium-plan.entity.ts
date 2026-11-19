import {
  Column,
  CreateDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export interface PlanPeriod {
  months: number;
  discountPercent: number;
}

@Entity('premium_plans')
export class PremiumPlan {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 100 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ default: true })
  isActive: boolean;

  @Column({ type: 'varchar', length: 7, nullable: true })
  color: string | null;

  @Column({ type: 'varchar', length: 50, nullable: true })
  icon: string | null;

  /** Highlight label shown above the plan card. */
  @Column({ type: 'varchar', length: 50, nullable: true })
  badge: string | null;

  /** Monthly price in Toman. */
  @Column({ type: 'int' })
  basePrice: number;

  @Column({ type: 'jsonb', default: () => "'[]'" })
  periods: PlanPeriod[];

  @Column({ type: 'jsonb', default: () => "'[]'" })
  features: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
