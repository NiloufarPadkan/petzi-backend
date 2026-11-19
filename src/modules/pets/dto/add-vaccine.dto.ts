import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class AddVaccineDto {
  @ApiProperty({
    example: 'Rabies',
    description: 'Vaccine name / type',
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  vaccineType: string;

  @ApiProperty({
    example: '2024-06-01',
    description: 'Date the vaccine was administered (ISO date)',
  })
  @IsDateString({}, { message: 'تاریخ واکسن معتبر نیست' })
  vaccineDate: string;

  @ApiProperty({
    required: false,
    example: '2025-06-01',
    description: 'When the next dose is due (drives reminders)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ نوبت بعدی معتبر نیست' })
  nextDueDate?: string;

  @ApiProperty({ required: false })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  notes?: string;
}
