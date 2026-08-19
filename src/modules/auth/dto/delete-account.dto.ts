import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class DeleteAccountDto {
  @ApiPropertyOptional({
    example: 'CurrentPass1!',
    description:
      'Required to confirm deletion for accounts with a password set. Not required for Google-only accounts.',
  })
  @IsOptional()
  @IsString()
  currentPassword?: string;
}
