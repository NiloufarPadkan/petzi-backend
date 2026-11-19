import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
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
import { ReservationStatus } from '../../../common/enums/admin-panel.enums';
import { trim } from '../../../common/utils/transform';

export class CreateReservationDto {
  @ApiProperty({ description: 'Pet owner (user) UUID' })
  @IsUUID()
  ownerId: string;

  @ApiPropertyOptional({ description: 'Must belong to the owner' })
  @IsOptional()
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional({ description: 'Vet account UUID' })
  @IsOptional()
  @IsUUID()
  vetId?: string;

  @ApiPropertyOptional({ description: 'Clinic account UUID' })
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiProperty({ example: 'ویزیت عمومی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نوع خدمت الزامی است' })
  @MaxLength(150)
  serviceName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  serviceDescription?: string;

  @ApiProperty({ example: '2026-12-01T10:30:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ default: 30, minimum: 5, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;

  @ApiPropertyOptional({ default: 0, description: 'Price in Toman' })
  @IsOptional()
  @IsInt()
  @Min(0)
  price?: number;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  clinicNote?: string;
}

export class UpdateReservationDto extends PartialType(CreateReservationDto) {}

export class RescheduleReservationDto {
  @ApiProperty({ example: '2026-12-02T11:00:00.000Z' })
  @IsDateString()
  scheduledAt: string;

  @ApiPropertyOptional({ minimum: 5, maximum: 480 })
  @IsOptional()
  @IsInt()
  @Min(5)
  @Max(480)
  durationMinutes?: number;
}

export class ChangeReservationStatusDto {
  @ApiProperty({
    enum: ReservationStatus,
    description: 'Use the cancel endpoint to cancel',
  })
  @IsEnum(ReservationStatus)
  status: ReservationStatus;
}

export class CancelReservationDto {
  @ApiProperty({ example: 'درخواست صاحب پت' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'دلیل لغو الزامی است' })
  @MaxLength(1000)
  reason: string;
}

export class ReservationNoteDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'متن یادداشت نمی‌تواند خالی باشد' })
  @MaxLength(2000)
  text: string;
}

export class QueryReservationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Code (BK-…), service, owner, pet or vet name/phone',
  })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  ownerId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  vetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  clinicId?: string;

  @ApiPropertyOptional({ example: '2026-12-01' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31' })
  @IsOptional()
  @IsDateString()
  to?: string;
}
