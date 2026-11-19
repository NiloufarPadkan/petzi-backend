import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { trim } from '../../../common/utils/transform';

export class CreateBookingDto {
  @ApiProperty({ description: "One of the owner's active pets" })
  @IsUUID()
  petId: string;

  @ApiProperty({ description: 'Vet account UUID' })
  @IsUUID()
  vetId: string;

  @ApiProperty({
    description: 'A service id from the vet detail (vet or clinic service)',
  })
  @IsUUID()
  serviceId: string;

  @ApiProperty({
    example: '2026-12-01T06:30:00.000Z',
    description: 'A slot start from the availability endpoint',
  })
  @IsDateString()
  startsAt: string;

  @ApiPropertyOptional({ description: 'Message for the clinic' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  note?: string;
}

export class QueryMyReservationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['upcoming', 'past'], default: 'upcoming' })
  @IsOptional()
  @IsIn(['upcoming', 'past'])
  tab: 'upcoming' | 'past' = 'upcoming';

  @ApiPropertyOptional({ description: 'Only one pet' })
  @IsOptional()
  @IsUUID()
  petId?: string;
}

export class CancelBookingDto {
  @ApiPropertyOptional({ example: 'برنامه من تغییر کرد' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class CreateReviewDto {
  @ApiProperty({ minimum: 1, maximum: 5 })
  @IsInt()
  @Min(1)
  @Max(5)
  rating: number;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'متن نظر نمی‌تواند خالی باشد' })
  @MaxLength(2000)
  comment: string;
}
