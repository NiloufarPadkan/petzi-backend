import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  ClinicActivityStatus,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';

export class ChangeClinicVerificationStatusDto {
  @ApiProperty({ enum: ClinicVerificationStatus })
  @IsEnum(ClinicVerificationStatus)
  status: ClinicVerificationStatus;

  @ApiPropertyOptional({ example: 'نیاز به تکمیل اطلاعات پروانه' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class ChangeClinicActivityStatusDto {
  @ApiProperty({ enum: ClinicActivityStatus })
  @IsEnum(ClinicActivityStatus)
  status: ClinicActivityStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class SuspendClinicDto {
  @ApiPropertyOptional({ description: 'دلیل تعلیق (اختیاری)' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}
