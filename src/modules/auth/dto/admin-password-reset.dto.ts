import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { trim } from '../../../common/utils/transform';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class AdminForgotPasswordDto {
  @ApiProperty({
    example: 'petziappadmin',
    description: 'Admin username, mobile number or email',
  })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'ایمیل یا شماره موبایل الزامی است' })
  @MaxLength(150)
  identifier: string;
}

export class AdminForgotPasswordVerifyDto extends AdminForgotPasswordDto {
  @ApiProperty({ example: '123456', minLength: 6, maxLength: 6 })
  @IsString()
  @Length(6, 6, { message: 'کد تأیید باید ۶ رقم باشد' })
  @Matches(/^\d{6}$/, { message: 'کد تأیید فقط باید شامل عدد باشد' })
  code: string;
}

export class AdminResetPasswordDto {
  @ApiProperty({ description: 'Returned by verify-otp' })
  @IsString()
  @IsNotEmpty({ message: 'توکن بازیابی الزامی است' })
  resetToken: string;

  @ApiProperty({ example: 'NewSecurePass1!' })
  @IsStrongPassword()
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور جدید الزامی است' })
  @MaxLength(72, { message: 'رمز عبور حداکثر باید ۷۲ کاراکتر باشد' })
  newPassword: string;
}
