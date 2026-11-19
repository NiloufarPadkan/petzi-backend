import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { ClinicType } from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';
import { InviteMemberDto } from './team.dto';

const LANDLINE_PATTERN = /^[0-9+\-\s]{5,20}$/;

export class RegisterClinicDto {
  @ApiProperty({ example: '09123456789', description: 'Manager mobile' })
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  phoneNumber: string;

  @ApiProperty({ description: 'Token from auth/register/verify-otp' })
  @IsString()
  @IsNotEmpty({ message: 'توکن ثبت‌نام الزامی است' })
  registrationToken: string;

  @ApiProperty({ example: 'دکتر نرگس احمدی', description: 'Manager name' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام مدیر الزامی است' })
  @MaxLength(100)
  managerName: string;

  @ApiProperty()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsStrongPassword()
  @IsString()
  @MaxLength(72, { message: 'رمز عبور حداکثر باید ۷۲ کاراکتر باشد' })
  password: string;

  @ApiProperty({ example: 'کلینیک مرکزی آریا' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام کلینیک الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ enum: ClinicType })
  @IsEnum(ClinicType)
  type: ClinicType;

  @ApiProperty({ example: '02188221100' })
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

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'آدرس الزامی است' })
  @MaxLength(500)
  address: string;

  @ApiProperty({ description: 'Legal license number' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شماره پروانه الزامی است' })
  @MaxLength(50)
  licenseNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  registrationNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  about?: string;

  @ApiProperty({ description: 'Must be true: the terms were accepted' })
  @Equals(true, { message: 'پذیرش قوانین و شرایط الزامی است' })
  acceptTerms: boolean;

  @ApiPropertyOptional({ description: 'Subscribe to news and updates' })
  @IsOptional()
  @IsBoolean()
  newsletter?: boolean;

  @ApiPropertyOptional({
    type: [InviteMemberDto],
    description: 'Optional team invitations',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => InviteMemberDto)
  invites?: InviteMemberDto[];
}
