import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { VetCollaborationStatus } from '../../../common/enums/vet-collaboration-status.enum';
import { trim } from '../../../common/utils/transform';
import { CreateVetDto } from './create-vet.dto';

export class UpdateVetDto extends PartialType(CreateVetDto) {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  verificationStatus?: ApprovalStatus;

  @ApiPropertyOptional({ enum: VetCollaborationStatus })
  @IsOptional()
  @IsEnum(VetCollaborationStatus)
  collaborationStatus?: VetCollaborationStatus;

  @ApiPropertyOptional({ description: 'دلیل تغییر وضعیت' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  statusChangeReason?: string;

  @ApiPropertyOptional({
    description: 'یادداشت داخلی مدیریت (غیر قابل نمایش برای دامپزشک)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
