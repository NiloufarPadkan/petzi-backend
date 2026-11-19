import {
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryGeneratedColumn,
} from 'typeorm';
import { FavoriteType } from '../../../common/enums/owner-app.enums';
import { User } from '../../users/entities/user.entity';

/** A vet or clinic a pet owner saved. Provider ids are users.id values. */
@Entity('favorite_providers')
@Index(['userId', 'providerType', 'providerId'], { unique: true })
export class FavoriteProvider {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({
    type: 'enum',
    enum: FavoriteType,
    enumName: 'favorite_providers_providertype_enum',
  })
  providerType: FavoriteType;

  @Column({ type: 'uuid' })
  providerId: string;

  @CreateDateColumn()
  createdAt: Date;
}
