import { Column, Entity, PrimaryColumn, UpdateDateColumn } from 'typeorm';

@Entity('system_settings')
export class SystemSetting {
  @PrimaryColumn({ length: 50 })
  group: string;

  @Column({ type: 'jsonb', default: () => "'{}'" })
  values: Record<string, unknown>;

  @Column({ type: 'uuid', nullable: true })
  updatedById: string | null;

  @UpdateDateColumn()
  updatedAt: Date;
}
