import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { stripHtmlTags } from '../../../common/utils/sanitize';

const trimAndStrip = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? stripHtmlTags(value).trim() : value;

export class UpdateAddressDto {
  @ApiPropertyOptional({ example: 'خانه', description: 'Address title' })
  @IsOptional()
  @Transform(trimAndStrip)
  @IsString()
  @IsNotEmpty({ message: 'عنوان آدرس نمی‌تواند خالی باشد.' })
  @MaxLength(100)
  title?: string;

  @ApiPropertyOptional({ example: 'تهران', description: 'City' })
  @IsOptional()
  @Transform(trimAndStrip)
  @IsString()
  @IsNotEmpty({ message: 'شهر نمی‌تواند خالی باشد.' })
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 'خیابان ولیعصر، پلاک ۱۲',
    description: 'Full address',
  })
  @IsOptional()
  @Transform(trimAndStrip)
  @IsString()
  @IsNotEmpty({ message: 'آدرس کامل نمی‌تواند خالی باشد.' })
  @MaxLength(500)
  fullAddress?: string;

  @ApiPropertyOptional({
    example: 35.6892523,
    description: 'Latitude (-90 to 90)',
  })
  @IsOptional()
  @IsLatitude({ message: 'عرض جغرافیایی معتبر نیست.' })
  @Min(25, { message: 'مختصات باید در محدوده ایران باشد.' })
  @Max(40, { message: 'مختصات باید در محدوده ایران باشد.' })
  latitude?: number;

  @ApiPropertyOptional({
    example: 51.3889631,
    description: 'Longitude (-180 to 180)',
  })
  @IsOptional()
  @IsLongitude({ message: 'طول جغرافیایی معتبر نیست.' })
  @Min(44, { message: 'مختصات باید در محدوده ایران باشد.' })
  @Max(63.5, { message: 'مختصات باید در محدوده ایران باشد.' })
  longitude?: number;

  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
