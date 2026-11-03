import { ApiProperty } from '@nestjs/swagger';
import {
  ClinicActivityStatus,
  ClinicImageCategory,
  ClinicLogType,
  ClinicType,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { NotificationPreferencesDto } from '../../users/dto/update-admin-user.dto';
import { VetRatingDto } from '../../vets/dto/vet-response.dto';

export class ClinicListItemDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) logoUrl: string | null;
  @ApiProperty({ enum: ClinicType }) type: ClinicType;
  @ApiProperty() province: string;
  @ApiProperty() city: string;
  @ApiProperty() phone: string;
  @ApiProperty({ enum: ClinicVerificationStatus })
  verificationStatus: ClinicVerificationStatus;
  @ApiProperty({ enum: ClinicActivityStatus })
  activityStatus: ClinicActivityStatus;
  @ApiProperty({ description: 'Registration date' }) createdAt: Date;
}

export class ClinicListResponseDto {
  @ApiProperty({ type: [ClinicListItemDto] }) items: ClinicListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class ClinicStatsDto {
  @ApiProperty() activeServices: number;
  @ApiProperty() totalServices: number;
  @ApiProperty({ description: 'Vets linked to this clinic' })
  vetsCount: number;
  @ApiProperty() imagesCount: number;
  @ApiProperty() approvedReviews: number;
  @ApiProperty() pendingReviews: number;
  @ApiProperty({ example: 96, description: '% of approved reviews rated 4+' })
  satisfactionPercent: number;
}

export class ClinicDetailDto extends ClinicListItemDto {
  @ApiProperty({ description: 'Manager name (the account holder)' })
  managerName: string | null;
  @ApiProperty({ description: "Manager's mobile (sign-in number)" })
  managerPhone: string;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty({ nullable: true }) about: string | null;
  @ApiProperty({ nullable: true }) licenseNumber: string | null;
  @ApiProperty({ nullable: true }) registrationNumber: string | null;
  @ApiProperty({ nullable: true }) foundedAt: string | null;
  @ApiProperty({ nullable: true }) brandColor: string | null;
  @ApiProperty() staffCount: number;
  @ApiProperty({ nullable: true }) secondaryPhone: string | null;
  @ApiProperty({ nullable: true }) website: string | null;
  @ApiProperty({ nullable: true }) instagram: string | null;
  @ApiProperty({ nullable: true }) postalCode: string | null;
  @ApiProperty() address: string;
  @ApiProperty({ nullable: true }) latitude: number | null;
  @ApiProperty({ nullable: true }) longitude: number | null;
  @ApiProperty({ nullable: true }) coverImageUrl: string | null;
  @ApiProperty() acceptsOnlineBooking: boolean;
  @ApiProperty() isListedInSearch: boolean;
  @ApiProperty() bookingCutoffHours: number;
  @ApiProperty({ type: NotificationPreferencesDto })
  notificationPreferences: NotificationPreferencesDto;
  @ApiProperty({ nullable: true }) statusChangeReason: string | null;
  @ApiProperty({ nullable: true }) adminNotes: string | null;
  @ApiProperty({ nullable: true }) lastLoginAt: Date | null;
  @ApiProperty({ type: VetRatingDto }) rating: VetRatingDto;
  @ApiProperty({ type: ClinicStatsDto }) stats: ClinicStatsDto;
}

export class ClinicLogActorDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) fullName: string | null;
}

export class ClinicLogDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: ClinicLogType }) type: ClinicLogType;
  @ApiProperty({ nullable: true }) status: string | null;
  @ApiProperty({ nullable: true }) reason: string | null;
  @ApiProperty({ type: ClinicLogActorDto, nullable: true })
  actor: ClinicLogActorDto | null;
  @ApiProperty() createdAt: Date;
}

export class ClinicImageResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty({ enum: ClinicImageCategory }) category: ClinicImageCategory;
  @ApiProperty() fileUrl: string;
  @ApiProperty() createdAt: Date;
}
