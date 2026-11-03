import { ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ClinicActivityStatus,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';
import { CreateClinicDto } from './create-clinic.dto';

export class UpdateClinicDto extends PartialType(CreateClinicDto) {
  @ApiPropertyOptional({ enum: ClinicVerificationStatus })
  @IsOptional()
  @IsEnum(ClinicVerificationStatus)
  verificationStatus?: ClinicVerificationStatus;

  @ApiPropertyOptional({ enum: ClinicActivityStatus })
  @IsOptional()
  @IsEnum(ClinicActivityStatus)
  activityStatus?: ClinicActivityStatus;

  @ApiPropertyOptional({ description: 'دلیل تغییر وضعیت' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  statusChangeReason?: string;

  @ApiPropertyOptional({
    description: 'یادداشت داخلی مدیریت (غیر قابل نمایش برای کلینیک)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;
}
