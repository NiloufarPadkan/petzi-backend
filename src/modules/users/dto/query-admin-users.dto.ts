import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { SubscriptionPlan } from '../../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../../common/enums/subscription-status.enum';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class QueryAdminUsersDto {
  @ApiPropertyOptional({
    description: 'Search by name, phone number, or email',
    example: 'سارا',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: 'Filter by city', example: 'تهران' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: SubscriptionStatus })
  @IsOptional()
  @IsEnum(SubscriptionStatus)
  status?: SubscriptionStatus;

  @ApiPropertyOptional({ enum: SubscriptionPlan })
  @IsOptional()
  @IsEnum(SubscriptionPlan)
  plan?: SubscriptionPlan;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}
