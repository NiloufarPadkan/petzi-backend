import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { ClinicImageCategory } from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';

export class UploadClinicImageDto {
  @ApiProperty({ example: 'ورودی اصلی و لابی کلینیک' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'عنوان تصویر الزامی است' })
  @MaxLength(150)
  title: string;

  @ApiProperty({ enum: ClinicImageCategory })
  @IsEnum(ClinicImageCategory)
  category: ClinicImageCategory;
}

export class UpdateClinicImageDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'عنوان تصویر نمی‌تواند خالی باشد' })
  @MaxLength(150)
  title?: string;

  @ApiPropertyOptional({ enum: ClinicImageCategory })
  @IsOptional()
  @IsEnum(ClinicImageCategory)
  category?: ClinicImageCategory;
}
