import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class GoogleExchangeDto {
  @ApiProperty({
    example: 'a1b2c3d4e5f6...',
    description: 'One-time code from the Google OAuth callback redirect',
  })
  @IsString()
  @IsNotEmpty({ message: 'کد تبادل گوگل الزامی است' })
  code: string;
}
