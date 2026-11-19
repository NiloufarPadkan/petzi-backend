import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { FavoriteType } from '../../../common/enums/owner-app.enums';
import { toBoolean, trim } from '../../../common/utils/transform';

export const PROVIDER_SORTS = [
  'rating',
  'reviews',
  'price_asc',
  'price_desc',
  'nearest',
] as const;
export type ProviderSort = (typeof PROVIDER_SORTS)[number];

class ProviderQueryBase extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name, specialty, clinic or service' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ minimum: 0, maximum: 5 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({
    description: 'Toman; providers with a service ≥ this',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Toman; providers with a service ≤ this',
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ enum: PROVIDER_SORTS, default: 'rating' })
  @IsOptional()
  @IsIn(PROVIDER_SORTS)
  sort: ProviderSort = 'rating';

  @ApiPropertyOptional({ description: 'Needed for sort=nearest and distances' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-90)
  @Max(90)
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(-180)
  @Max(180)
  lng?: number;

  @ApiPropertyOptional({ description: 'Only favorites' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  favoritesOnly?: boolean;
}

export class QueryVetsDto extends ProviderQueryBase {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  specialty?: string;

  @ApiPropertyOptional({ description: 'Vets of one clinic' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ description: 'Also compute the next free slot' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  includeNextSlot?: boolean;
}

export class QueryClinicsDto extends ProviderQueryBase {}

export class AvailabilityQueryDto {
  @ApiPropertyOptional({ example: '2026-12-01', description: 'Tehran date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ default: 7, minimum: 1, maximum: 31 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(31)
  days?: number;

  @ApiPropertyOptional({ description: 'Sizes slots to this service duration' })
  @IsOptional()
  @IsUUID()
  serviceId?: string;
}

export class FavoriteDto {
  @ApiProperty({ enum: FavoriteType })
  @IsEnum(FavoriteType)
  providerType: FavoriteType;

  @ApiProperty({ description: 'Vet or clinic user id' })
  @IsUUID()
  providerId: string;
}

export class LocationQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lat?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  lng?: number;
}
