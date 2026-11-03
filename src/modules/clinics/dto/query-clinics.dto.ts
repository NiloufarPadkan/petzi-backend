import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import {
  ClinicActivityStatus,
  ClinicType,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';

export class QueryClinicsDto {
  @ApiPropertyOptional({
    description: 'Search by clinic name, manager name, phone or email',
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

  @ApiPropertyOptional({ enum: ClinicType })
  @IsOptional()
  @IsEnum(ClinicType)
  type?: ClinicType;

  @ApiPropertyOptional({ enum: ClinicVerificationStatus })
  @IsOptional()
  @IsEnum(ClinicVerificationStatus)
  verificationStatus?: ClinicVerificationStatus;

  @ApiPropertyOptional({ enum: ClinicActivityStatus })
  @IsOptional()
  @IsEnum(ClinicActivityStatus)
  activityStatus?: ClinicActivityStatus;

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
