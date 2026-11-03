import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
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
import { NotificationPreferencesDto } from './update-admin-user.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateAdminUserDto {
  @ApiProperty({ example: 'سارا احمدی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام و نام خانوادگی الزامی است' })
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '09123456789' })
  @Transform(trim)
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  phoneNumber: string;

  @ApiPropertyOptional({ example: 'sara.ahmadi@example.com' })
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiPropertyOptional({ example: '1990-01-15' })
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ تولد معتبر نیست' })
  dateOfBirth?: string;

  @ApiPropertyOptional({
    example: 'تهران',
    description: 'Required together with fullAddress',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شهر نمی‌تواند خالی باشد' })
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({
    example: 'خیابان ولیعصر، نرسیده به میدان ونک',
    description: 'Required together with city',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نشانی نمی‌تواند خالی باشد' })
  @MaxLength(500)
  fullAddress?: string;

  @ApiPropertyOptional({
    enum: SubscriptionPlan,
    default: SubscriptionPlan.FREE,
  })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  subscriptionPlan?: SubscriptionPlan;

  @ApiPropertyOptional({
    enum: SubscriptionStatus,
    default: SubscriptionStatus.ACTIVE,
  })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  subscriptionStatus?: SubscriptionStatus;

  @ApiPropertyOptional({
    description: 'دلیل تعیین وضعیت حساب کاربری',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  statusChangeReason?: string;

  @ApiPropertyOptional({ type: NotificationPreferencesDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}
