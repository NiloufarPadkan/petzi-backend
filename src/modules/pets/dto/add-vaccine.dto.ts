import { ApiProperty } from '@nestjs/swagger';
import { IsDateString, IsNotEmpty, IsString, MaxLength } from 'class-validator';

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
}
