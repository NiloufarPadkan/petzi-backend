import { ApiProperty } from '@nestjs/swagger';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { PersonGender } from '../../../common/enums/person-gender.enum';
import { VetCollaborationStatus } from '../../../common/enums/vet-collaboration-status.enum';
import { VetStatusLogType } from '../../../common/enums/vet-status-log-type.enum';
import { NotificationPreferencesDto } from '../../users/dto/update-admin-user.dto';

export class VetListItemDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) fullName: string | null;
  @ApiProperty({ nullable: true }) email: string | null;
  @ApiProperty() phoneNumber: string;
  @ApiProperty({ nullable: true }) profilePictureUrl: string | null;
  @ApiProperty() primarySpecialty: string;
  @ApiProperty({ nullable: true }) clinicId: string | null;
  @ApiProperty({ nullable: true }) clinicName: string | null;
  @ApiProperty() city: string;
  @ApiProperty() medicalCouncilNumber: string;
  @ApiProperty({ enum: ApprovalStatus }) verificationStatus: ApprovalStatus;
  @ApiProperty({ enum: VetCollaborationStatus })
  collaborationStatus: VetCollaborationStatus;
  @ApiProperty() createdAt: Date;
}

export class VetListResponseDto {
  @ApiProperty({ type: [VetListItemDto] }) items: VetListItemDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class VetRatingDto {
  @ApiProperty({ example: 4.8, description: 'Average of approved reviews' })
  average: number;

  @ApiProperty({ example: 285, description: 'Number of approved reviews' })
  count: number;
}

export class VetStatsDto {
  @ApiProperty() activeServices: number;
  @ApiProperty() totalServices: number;
  @ApiProperty() approvedReviews: number;
  @ApiProperty() pendingReviews: number;
  @ApiProperty({ example: 96, description: '% of approved reviews rated 4+' })
  satisfactionPercent: number;
}

export class VetDetailDto extends VetListItemDto {
  @ApiProperty({ nullable: true }) dateOfBirth: string | null;
  @ApiProperty({ enum: PersonGender, nullable: true })
  gender: PersonGender | null;
  @ApiProperty({ nullable: true }) nationalCode: string | null;
  @ApiProperty({ nullable: true }) bio: string | null;
  @ApiProperty({ type: [String] }) subSpecialties: string[];
  @ApiProperty({ nullable: true }) highestDegree: string | null;
  @ApiProperty({ nullable: true }) university: string | null;
  @ApiProperty({ nullable: true }) graduationYear: number | null;
  @ApiProperty({ type: [String] }) languages: string[];
  @ApiProperty({ nullable: true }) clinicPhone: string | null;
  @ApiProperty({ nullable: true }) clinicAddress: string | null;
  @ApiProperty({ nullable: true }) instagram: string | null;
  @ApiProperty({ nullable: true }) telegram: string | null;
  @ApiProperty({ nullable: true }) linkedin: string | null;
  @ApiProperty({ type: NotificationPreferencesDto })
  notificationPreferences: NotificationPreferencesDto;
  @ApiProperty({ nullable: true }) statusChangeReason: string | null;
  @ApiProperty({ nullable: true }) adminNotes: string | null;
  @ApiProperty({ nullable: true }) lastLoginAt: Date | null;
  @ApiProperty({ type: VetRatingDto }) rating: VetRatingDto;
  @ApiProperty({ type: VetStatsDto }) stats: VetStatsDto;
}

export class VetStatusLogActorDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) fullName: string | null;
}

export class VetStatusLogDto {
  @ApiProperty() id: string;
  @ApiProperty({ enum: VetStatusLogType }) type: VetStatusLogType;
  @ApiProperty({ nullable: true }) status: string | null;
  @ApiProperty({ nullable: true }) reason: string | null;
  @ApiProperty({ type: VetStatusLogActorDto, nullable: true })
  actor: VetStatusLogActorDto | null;
  @ApiProperty() createdAt: Date;
}
