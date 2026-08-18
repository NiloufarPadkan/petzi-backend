import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';

export class SendOtpDto {
  @ApiProperty({
    example: '09123456789',
    description: 'Iranian mobile number (09xxxxxxxxx or +98...)',
  })
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  phoneNumber: string;
}

export class VerifyOtpDto {
  @ApiProperty({
    example: '09123456789',
    description: 'Iranian mobile number used to request the OTP',
  })
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  phoneNumber: string;

  @ApiProperty({
    example: '123456',
    description: '6-digit OTP code',
    minLength: 6,
    maxLength: 6,
  })
  @IsString()
  @Length(6, 6, { message: 'کد تأیید باید ۶ رقم باشد' })
  @Matches(/^\d{6}$/, { message: 'کد تأیید فقط باید شامل عدد باشد' })
  code: string;
}
