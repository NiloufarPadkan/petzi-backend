import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import {
  PetEventType,
  SurgeryStatus,
} from '../../../common/enums/owner-app.enums';
import { trim } from '../../../common/utils/transform';

export class CreateWeightDto {
  @ApiProperty({ example: 4.2, description: 'kg' })
  @IsNumber()
  @Min(0.01)
  @Max(500)
  weightKg: number;

  @ApiPropertyOptional({
    example: '2026-12-01',
    description: 'Defaults to today',
  })
  @IsOptional()
  @IsDateString()
  measuredAt?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  note?: string;
}

export class WeightsQueryDto {
  @ApiPropertyOptional({ enum: ['1m', '3m', '6m', '1y', 'all'], default: '6m' })
  @IsOptional()
  @IsIn(['1m', '3m', '6m', '1y', 'all'])
  range: '1m' | '3m' | '6m' | '1y' | 'all' = '6m';
}

export class CreateEventDto {
  @ApiProperty({ enum: PetEventType })
  @IsEnum(PetEventType)
  type: PetEventType;

  @ApiProperty({ example: 'حمام و اصلاح' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'عنوان رویداد الزامی است' })
  @MaxLength(150)
  title: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  note?: string;

  @ApiPropertyOptional({ description: 'Defaults to now' })
  @IsOptional()
  @IsDateString()
  eventAt?: string;
}

export class UpdateEventDto extends PartialType(CreateEventDto) {}

export class CreateMedicationDto {
  @ApiProperty({ example: 'آموکسی‌سیلین' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام دارو الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: '۲۵۰ میلی‌گرم' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  dosage?: string;

  @ApiPropertyOptional({ example: 'روزی دو بار' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  frequency?: string;

  @ApiProperty({ example: '2026-12-01' })
  @IsDateString()
  startDate: string;

  @ApiPropertyOptional({ example: '2026-12-10' })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

export class UpdateMedicationDto extends PartialType(CreateMedicationDto) {}

export class CreateSurgeryDto {
  @ApiProperty({ example: 'عقیم‌سازی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام جراحی الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: '2026-11-20' })
  @IsDateString()
  surgeryDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  vetName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  clinicName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  notes?: string;

  @ApiPropertyOptional({ enum: SurgeryStatus, default: 'done' })
  @IsOptional()
  @IsEnum(SurgeryStatus)
  status?: SurgeryStatus;
}

export class UpdateSurgeryDto extends PartialType(CreateSurgeryDto) {}

export class UpdateVaccineDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vaccineName?: string;

  @ApiPropertyOptional({ example: '2026-06-01' })
  @IsOptional()
  @IsDateString()
  vaccineDate?: string;

  @ApiPropertyOptional({ example: '2027-06-01' })
  @IsOptional()
  @IsDateString()
  nextDueDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  notes?: string;
}

export class TimelineQueryDto {
  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  limit: number = 20;

  @ApiPropertyOptional({
    description: 'Only items before this instant (cursor from nextBefore)',
  })
  @IsOptional()
  @IsDateString()
  before?: string;

  @ApiPropertyOptional({
    description:
      'Comma separated: reservation,vaccine,event,weight,surgery,medication,document',
  })
  @IsOptional()
  @IsString()
  kinds?: string;
}
