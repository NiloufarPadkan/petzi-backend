import { ApiProperty } from '@nestjs/swagger';
import { SubscriptionPlan } from '../../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../../common/enums/subscription-status.enum';
import { NotificationPreferencesDto } from './update-admin-user.dto';

export class AdminUserResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'سارا احمدی', nullable: true })
  fullName: string | null;

  @ApiProperty({ example: 'sara.ahmadi@example.com', nullable: true })
  email: string | null;

  @ApiProperty({ example: '09123456789' })
  phoneNumber: string;

  @ApiProperty({ example: '1990-01-15', nullable: true })
  dateOfBirth: string | null;

  @ApiProperty({ example: null, nullable: true })
  profilePictureUrl: string | null;

  @ApiProperty({ example: 'تهران', nullable: true })
  city: string | null;

  @ApiProperty({
    example: 'خیابان ولیعصر، نرسیده به میدان ونک',
    nullable: true,
  })
  fullAddress: string | null;

  @ApiProperty({ example: 3 })
  petsCount: number;

  @ApiProperty({ enum: SubscriptionPlan })
  subscriptionPlan: SubscriptionPlan;

  @ApiProperty({ enum: SubscriptionStatus })
  subscriptionStatus: SubscriptionStatus;

  @ApiProperty({ type: NotificationPreferencesDto })
  notificationPreferences: NotificationPreferencesDto;

  @ApiProperty({ nullable: true })
  statusChangeReason: string | null;

  @ApiProperty({ nullable: true })
  adminNotes: string | null;

  @ApiProperty()
  createdAt: Date;
}

export class AdminUsersListResponseDto {
  @ApiProperty({ type: [AdminUserResponseDto] })
  items: AdminUserResponseDto[];

  @ApiProperty({ example: 42 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;
}
