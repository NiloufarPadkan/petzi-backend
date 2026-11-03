import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { VetCollaborationStatus } from '../../../common/enums/vet-collaboration-status.enum';
import { trim } from '../../../common/utils/transform';

export class ChangeVerificationStatusDto {
  @ApiProperty({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiPropertyOptional({ example: 'نقص در مدارک ارسالی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ChangeCollaborationStatusDto {
  @ApiProperty({ enum: VetCollaborationStatus })
  @IsEnum(VetCollaborationStatus)
  status: VetCollaborationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class SuspendVetDto {
  @ApiPropertyOptional({ description: 'دلیل تعلیق (اختیاری)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
