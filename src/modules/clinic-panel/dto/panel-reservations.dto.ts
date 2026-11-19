import {
  ApiProperty,
  ApiPropertyOptional,
  OmitType,
  PartialType,
} from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { ReservationStatus } from '../../../common/enums/admin-panel.enums';
import { trim } from '../../../common/utils/transform';
import { CreateReservationDto } from '../../reservations/dto/reservation.dto';

export class PanelQueryReservationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ['all', 'today'], default: 'all' })
  @IsOptional()
  @IsIn(['all', 'today'])
  scope: 'all' | 'today' = 'all';

  @ApiPropertyOptional({ enum: ReservationStatus })
  @IsOptional()
  @IsEnum(ReservationStatus)
  status?: ReservationStatus;

  @ApiPropertyOptional({ description: 'Vet account UUID' })
  @IsOptional()
  @IsUUID()
  vetId?: string;

  @ApiPropertyOptional({ description: 'Code (BK-…), pet, owner or service' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ example: '2026-12-01', description: 'Tehran date' })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Tehran date' })
  @IsOptional()
  @IsDateString()
  to?: string;

  @ApiPropertyOptional({ enum: ['newest', 'oldest'], default: 'newest' })
  @IsOptional()
  @IsIn(['newest', 'oldest'])
  sort: 'newest' | 'oldest' = 'newest';
}

export class CalendarQueryDto {
  @ApiProperty({ example: '2026-12-01', description: 'Tehran date' })
  @IsDateString()
  from: string;

  @ApiProperty({ example: '2026-12-31', description: 'Tehran date' })
  @IsDateString()
  to: string;
}

export class PanelCreateReservationDto extends OmitType(CreateReservationDto, [
  'clinicId',
] as const) {}

export class PanelUpdateReservationDto extends PartialType(
  PanelCreateReservationDto,
) {}
