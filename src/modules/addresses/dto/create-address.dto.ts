import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateAddressDto {
  @ApiProperty({ example: 'خانه', description: 'Address title' })
  @Transform(trimAndStrip)
  @IsString()
  @IsNotEmpty({ message: 'عنوان آدرس الزامی است.' })
  @MaxLength(100)
  title: string;

  @ApiProperty({ example: 'تهران', description: 'City' })
  @Transform(trimAndStrip)
  @IsString()
  @IsNotEmpty({ message: 'شهر الزامی است.' })
  @MaxLength(100)
  city: string;

  @ApiProperty({
    example: 'خیابان ولیعصر، پلاک ۱۲',
    description: 'Full address',
  })
  @Transform(trimAndStrip)
  @IsString()
  @IsNotEmpty({ message: 'آدرس کامل الزامی است.' })
  @MaxLength(500)
  fullAddress: string;

  @ApiProperty({ example: 35.6892523, description: 'Latitude (-90 to 90)' })
  @IsLatitude({ message: 'عرض جغرافیایی معتبر نیست.' })
  @Min(25, { message: 'مختصات باید در محدوده ایران باشد.' })
  @Max(40, { message: 'مختصات باید در محدوده ایران باشد.' })
  latitude: number;

  @ApiProperty({ example: 51.3889631, description: 'Longitude (-180 to 180)' })
  @IsLongitude({ message: 'طول جغرافیایی معتبر نیست.' })
  @Min(44, { message: 'مختصات باید در محدوده ایران باشد.' })
  @Max(63.5, { message: 'مختصات باید در محدوده ایران باشد.' })
  longitude: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsOptional()
  @IsBoolean()
  isDefault?: boolean;
}
