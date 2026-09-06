import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsNotEmpty,
  IsString,
  MaxLength,
} from 'class-validator';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class RegisterDto {
  @ApiProperty({ example: '09123456789' })
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  phoneNumber: string;

  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'Short-lived registration token from register/verify-otp',
  })
  @IsString()
  @IsNotEmpty({ message: 'توکن ثبت‌نام الزامی است' })
  registrationToken: string;

  @ApiProperty({ example: 'علی محمدی' })
  @IsString()
  @IsNotEmpty({ message: 'نام و نام خانوادگی الزامی است' })
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: 'ali@example.com' })
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  @IsNotEmpty({ message: 'ایمیل الزامی است' })
  email: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString({}, { message: 'تاریخ تولد معتبر نیست' })
  @IsNotEmpty({ message: 'تاریخ تولد الزامی است' })
  dateOfBirth: string;

  @ApiProperty({ example: 'SecurePass1!' })
  @IsStrongPassword()
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است' })
  @MaxLength(72, { message: 'رمز عبور حداکثر باید ۷۲ کاراکتر باشد' })
  password: string;
}
