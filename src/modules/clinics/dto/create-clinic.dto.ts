import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { ClinicType } from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';
import { NotificationPreferencesDto } from '../../users/dto/update-admin-user.dto';

const LANDLINE_PATTERN = /^[0-9+\-\s]{5,20}$/;

export class CreateClinicDto {
  @ApiProperty({ example: 'کلینیک دامپزشکی مهر' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام کلینیک الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: ClinicType })
  @IsEnum(ClinicType)
  type: ClinicType;

  @ApiProperty({ example: 'دکتر نرگس احمدی', description: 'Manager name' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام مدیر الزامی است' })
  @MaxLength(100)
  managerName: string;

  @ApiProperty({
    example: '09123456789',
    description:
      "Manager's mobile number; used to sign in to the clinic account",
  })
  @Transform(trim)
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل مدیر الزامی است' })
  managerPhone: string;

  @ApiProperty({ example: '02188221100', description: 'Clinic landline' })
  @Transform(trim)
  @Matches(LANDLINE_PATTERN, { message: 'شماره تماس معتبر نیست' })
  phone: string;

  @ApiProperty({ example: 'تهران' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'استان الزامی است' })
  @MaxLength(100)
  province: string;

  @ApiProperty({ example: 'تهران' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شهر الزامی است' })
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'سعادت‌آباد، سرو شرقی، پلاک ۱۲' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'آدرس الزامی است' })
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional({ example: 'info@mehrvetclinic.ir' })
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{10}$/, { message: 'کد پستی باید ۱۰ رقم باشد' })
  postalCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  about?: string;

  @ApiPropertyOptional({ example: 'ج-۹۸/۴۵۶۲' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  @ApiPropertyOptional({ example: '23456' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @ApiPropertyOptional({ example: '2019-07-06' })
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ تأسیس معتبر نیست' })
  foundedAt?: string;

  @ApiPropertyOptional({ example: '#8B5CF6' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^#[0-9a-fA-F]{6}$/, {
    message: 'رنگ برند باید به شکل #RRGGBB باشد',
  })
  brandColor?: string;

  @ApiPropertyOptional({ example: 12 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(100000)
  staffCount?: number;

  @ApiPropertyOptional({ example: '02188995544' })
  @IsOptional()
  @Transform(trim)
  @Matches(LANDLINE_PATTERN, { message: 'شماره تماس معتبر نیست' })
  secondaryPhone?: string;

  @ApiPropertyOptional({ example: 'www.mehrvetclinic.ir' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional({ example: 'instagram.com/mehrvetclinic' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  instagram?: string;

  @ApiPropertyOptional({ example: 35.7219 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional({ example: 51.3347 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  acceptsOnlineBooking?: boolean;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isListedInSearch?: boolean;

  @ApiPropertyOptional({
    default: 2,
    description: 'Online bookings close this many hours before the visit',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(720)
  bookingCutoffHours?: number;

  @ApiPropertyOptional({
    type: NotificationPreferencesDto,
    description: 'reservationAlerts = new-appointment announcements',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}
