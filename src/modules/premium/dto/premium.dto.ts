import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CheckoutDto {
  @ApiProperty({ description: 'A plan id from GET /premium/plans' })
  @IsUUID()
  planId: string;

  @ApiPropertyOptional({
    default: 1,
    description: 'Subscription length; must be 1 or one of the plan periods',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(36)
  months?: number;

  @ApiPropertyOptional({
    example: 'zarinpal',
    description: 'Defaults to the first enabled gateway',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  gateway?: string;
}
