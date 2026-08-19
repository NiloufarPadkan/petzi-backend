import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { IsStrongPassword } from '../../../common/validators/is-strong-password.validator';

export class ChangePasswordDto {
  @ApiProperty({ example: 'OldPass1!' })
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور فعلی الزامی است' })
  currentPassword: string;

  @ApiProperty({ example: 'NewSecurePass1!' })
  @IsStrongPassword()
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور جدید الزامی است' })
  @MaxLength(72, { message: 'رمز عبور حداکثر باید ۷۲ کاراکتر باشد' })
  newPassword: string;
}
