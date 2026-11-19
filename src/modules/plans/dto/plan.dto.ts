import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { toBoolean, trim } from '../../../common/utils/transform';

export class PlanPeriodDto {
  @ApiProperty({ example: 3, description: 'Billing period in months' })
  @IsInt()
  @Min(1)
  @Max(36)
  months: number;

  @ApiProperty({ example: 10, description: 'Discount on the period total' })
  @IsInt()
  @Min(0)
  @Max(90)
  discountPercent: number;
}

export class CreatePlanDto {
  @ApiProperty({ example: 'پلن استاندارد' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام پلن الزامی است' })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ example: '#7C3AED' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'رنگ باید به صورت #RRGGBB باشد' })
  color?: string;

  @ApiPropertyOptional({ example: 'crown' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  icon?: string;

  @ApiPropertyOptional({ example: 'محبوب‌ترین' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  badge?: string;

  @ApiProperty({ example: 150000, description: 'Monthly price in Toman' })
  @IsInt()
  @Min(0)
  basePrice: number;

  @ApiPropertyOptional({ type: [PlanPeriodDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(12)
  @ValidateNested({ each: true })
  @Type(() => PlanPeriodDto)
  periods?: PlanPeriodDto[];

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  @MaxLength(200, { each: true })
  features?: string[];

  @ApiPropertyOptional({ default: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  sortOrder?: number;
}

export class UpdatePlanDto extends PartialType(CreatePlanDto) {}

export class QueryPlansDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  isActive?: boolean;
}

export class PlanStatsDto {
  @ApiProperty() activeSubscribers: number;
  @ApiProperty({ description: 'Net revenue (Toman) over the last 30 days' })
  monthlyRevenue: number;
}

export class PlanResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true }) color: string | null;
  @ApiProperty({ nullable: true }) icon: string | null;
  @ApiProperty({ nullable: true }) badge: string | null;
  @ApiProperty() basePrice: number;
  @ApiProperty({ type: [PlanPeriodDto] }) periods: PlanPeriodDto[];
  @ApiProperty({ type: [String] }) features: string[];
  @ApiProperty() sortOrder: number;
  @ApiProperty({ type: PlanStatsDto }) stats: PlanStatsDto;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PlansOverviewDto {
  @ApiProperty() activeSubscriptions: number;
  @ApiProperty({ description: 'New paid subscriptions in the last 30 days' })
  newSubscriptions: number;
  @ApiProperty({ description: 'Subscription revenue (Toman), last 30 days' })
  monthlyRevenue: number;
  @ApiProperty({ nullable: true, description: 'vs the previous 30 days' })
  revenueChangePercent: number | null;
  @ApiProperty({ nullable: true })
  mostPopularPlan: {
    id: string;
    name: string;
    subscribers: number;
    sharePercent: number;
  } | null;
}
