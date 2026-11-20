import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

export class TwoFactorPasswordDto {
  @ApiProperty({ description: 'The account password' })
  @IsString()
  @IsNotEmpty({ message: 'رمز عبور الزامی است' })
  @MaxLength(72)
  password: string;
}

export class TwoFactorLoginDto {
  @ApiProperty({
    description: 'The twoFactorToken returned by the first sign-in step',
  })
  @IsString()
  @IsNotEmpty({ message: 'توکن ورود الزامی است' })
  @MaxLength(64)
  twoFactorToken: string;

  @ApiPropertyOptional({ description: 'The account password' })
  @IsOptional()
  @IsString()
  @MaxLength(72)
  password?: string;

  @ApiPropertyOptional({
    example: 'ABCDE-FGHJK',
    description: 'One unused recovery code, instead of the password',
  })
  @IsOptional()
  @IsString()
  @MaxLength(32)
  recoveryCode?: string;
}
