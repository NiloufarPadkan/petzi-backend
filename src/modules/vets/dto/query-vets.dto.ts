import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { VetCollaborationStatus } from '../../../common/enums/vet-collaboration-status.enum';
import { trim } from '../../../common/utils/transform';

export class QueryVetsDto {
  @ApiPropertyOptional({
    description: 'Search by name, phone, email or medical council number',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: 'تهران' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  city?: string;

  @ApiPropertyOptional({ example: 'جراحی و بافت نرم' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Only vets of this clinic',
  })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  verificationStatus?: ApprovalStatus;

  @ApiPropertyOptional({ enum: VetCollaborationStatus })
  @IsOptional()
  @IsEnum(VetCollaborationStatus)
  collaborationStatus?: VetCollaborationStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
