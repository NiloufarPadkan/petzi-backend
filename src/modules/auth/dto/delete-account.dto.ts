import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Length,
  Matches,
  ValidateIf,
} from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    example: 'CurrentPass1!',
    description:
      'Password step-up for accounts with a password. Alternative: OTP code.',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;

  @ApiPropertyOptional({
    example: '123456',
    description:
      'Delete-account OTP (Iranian mobile accounts). Alternative to password.',
  })
  @ValidateIf((o: DeleteAccountDto) => !!o.code)
  @IsString()
  @Length(6, 6, { message: 'کد تأیید باید ۶ رقم باشد' })
  @Matches(/^\d{6}$/, { message: 'کد تأیید فقط باید شامل عدد باشد' })
  code?: string;

  @ApiPropertyOptional({
    description:
      'Fresh Google one-time exchange code. Required step-up for Google-only accounts without a password.',
  })
  @IsOptional()
  @IsString()
  googleExchangeCode?: string;
}
