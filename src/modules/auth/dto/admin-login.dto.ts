import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class AdminLoginDto {
  @ApiProperty({ example: 'petziappadmin' })
  @IsString()
  @IsNotEmpty({ message: 'نام کاربری الزامی است' })
  username: string;

  @ApiProperty({ example: 'strong-password' })
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است' })
  password: string;
}
