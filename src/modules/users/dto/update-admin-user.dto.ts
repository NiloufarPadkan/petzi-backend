import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { SubscriptionPlan } from '../../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../../common/enums/subscription-status.enum';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class NotificationPreferencesDto {
  @ApiPropertyOptional({ example: false })
  @IsOptional()
  @IsBoolean()
  newsletter?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  reservationAlerts?: boolean;

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  messageAlerts?: boolean;
}

export class UpdateAdminUserDto {
  @ApiPropertyOptional({ example: 'سارا احمدی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام نمی‌تواند خالی باشد' })
  @MaxLength(100)
  fullName?: string;

  @ApiPropertyOptional({ example: 'sara.ahmadi@example.com' })
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiPropertyOptional({ example: '09123456789' })
  @IsOptional()
  @Transform(trim)
  @IsIranianPhone()
  phoneNumber?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ تولد معتبر نیست' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ example: 'تهران' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شهر نمی‌تواند خالی باشد' })
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'خیابان ولیعصر، نرسیده به میدان ونک' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نشانی نمی‌تواند خالی باشد' })
  @MaxLength(500)
  fullAddress?: string;

  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'دلیل تغییر وضعیت حساب کاربری',
    example: 'کاربر ویژه با سابقه پرداخت منظم',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  statusChangeReason?: string;

  @ApiPropertyOptional({
    description: 'یادداشت داخلی مدیریت (غیر قابل نمایش برای کاربر)',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  adminNotes?: string;

  @ApiPropertyOptional({ type: NotificationPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}
