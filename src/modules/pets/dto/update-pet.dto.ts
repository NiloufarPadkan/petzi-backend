import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNumber,
  IsNotEmpty,
  IsOptional,
  IsPositive,
  IsString,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PetType } from '../../../common/enums/pet-type.enum';
import { PetGender } from '../../../common/enums/pet-gender.enum';
import { ApproximateAge } from '../../../common/enums/approximate-age.enum';
import { HealthStatus } from '../../../common/enums/health-status.enum';
import { VaccinationStatus } from '../../../common/enums/vaccination-status.enum';
import { FoodType } from '../../../common/enums/food-type.enum';
import { MealsPerDay } from '../../../common/enums/meals-per-day.enum';

export class UpdatePetDto {
  @ApiPropertyOptional({
    example: 'پشمک',
    description: 'Pet name',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @IsNotEmpty({ message: 'نام حیوان خانگی نمی‌تواند خالی باشد' })
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({
    enum: PetType,
    example: PetType.CAT,
    description: 'Pet type: cat, dog, rabbit, bird, hamster, snake, other',
  })
  @IsOptional()
  @IsEnum(PetType)
  type?: PetType;

  @ApiPropertyOptional({
    example: 'Persian',
    description: 'Breed (optional)',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  breed?: string;

  @ApiPropertyOptional({
    enum: PetGender,
    example: PetGender.FEMALE,
    description: 'Gender: male, female, unknown',
  })
  @IsOptional()
  @IsEnum(PetGender)
  gender?: PetGender;

  @ApiPropertyOptional({
    example: '2022-03-21',
    description:
      'Exact birth date (ISO). Mutually exclusive with approximateAge. Convert Jalali to ISO on frontend.',
  })
  @IsOptional()
  @ValidateIf((o: UpdatePetDto) => o.approximateAge === undefined)
  @IsDateString({}, { message: 'تاریخ تولد معتبر نیست' })
  birthDate?: string;

  @ApiPropertyOptional({
    enum: ApproximateAge,
    example: ApproximateAge.TWO_TO_4_YEARS,
    description:
      'Approximate age when exact birth date is unknown. Mutually exclusive with birthDate.',
  })
  @IsOptional()
  @ValidateIf((o: UpdatePetDto) => o.birthDate === undefined)
  @IsEnum(ApproximateAge)
  approximateAge?: ApproximateAge;

  @ApiPropertyOptional({ example: 'white', description: 'Pet color' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  color?: string;

  @ApiPropertyOptional({
    example: 'Blue eyes, short tail',
    description: 'Physical appearance notes',
  })
  @IsOptional()
  @IsString()
  appearanceFeatures?: string;

  @ApiPropertyOptional({
    example: 8.4,
    description: 'Weight in kilograms',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  weight?: number;

  @ApiPropertyOptional({
    example: 45,
    description: 'Height in centimeters',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  height?: number;

  @ApiPropertyOptional({
    enum: HealthStatus,
    example: HealthStatus.GOOD,
    description: 'Health status: excellent, good, average, needs_checkup',
  })
  @IsOptional()
  @IsEnum(HealthStatus)
  healthStatus?: HealthStatus;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Underlying diseases (default: None)',
  })
  @IsOptional()
  @IsString()
  underlyingDiseases?: string;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Allergies (default: None)',
  })
  @IsOptional()
  @IsString()
  allergies?: string;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Current medications (default: None)',
  })
  @IsOptional()
  @IsString()
  medications?: string;

  @ApiPropertyOptional({ description: 'Additional health notes' })
  @IsOptional()
  @IsString()
  healthNotes?: string;

  @ApiPropertyOptional({
    enum: VaccinationStatus,
    example: VaccinationStatus.COMPLETE,
    description: 'Vaccination status: none, in_progress, complete',
  })
  @IsOptional()
  @IsEnum(VaccinationStatus)
  vaccinationStatus?: VaccinationStatus;

  @ApiPropertyOptional({
    example: '2025-01-15',
    description: 'Last deworming date (ISO)',
  })
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ آخرین ضد انگل معتبر نیست' })
  lastDewormingDate?: string;

  @ApiPropertyOptional({
    example: 'Broad-spectrum',
    description: 'Deworming type',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  dewormingType?: string;

  @ApiPropertyOptional({
    enum: FoodType,
    example: FoodType.DRY,
    description: 'Food type: dry, wet, homemade, mixed',
  })
  @IsOptional()
  @IsEnum(FoodType)
  foodType?: FoodType;

  @ApiPropertyOptional({
    example: 'Royal Canin',
    description: 'Main food brand',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  foodBrand?: string;

  @ApiPropertyOptional({
    enum: MealsPerDay,
    example: MealsPerDay.TWO,
    description: 'Meals per day: 1, 2, 3, 4, more',
  })
  @IsOptional()
  @IsEnum(MealsPerDay)
  mealsPerDay?: MealsPerDay;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Food sensitivities (default: None)',
  })
  @IsOptional()
  @IsString()
  foodSensitivities?: string;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Past surgeries (default: None)',
  })
  @IsOptional()
  @IsString()
  surgeries?: string;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Previous diseases (default: None)',
  })
  @IsOptional()
  @IsString()
  previousDiseases?: string;

  @ApiPropertyOptional({
    example: 'None',
    description: 'Hospitalizations (default: None)',
  })
  @IsOptional()
  @IsString()
  hospitalizations?: string;

  @ApiPropertyOptional({ description: 'Additional medical notes' })
  @IsOptional()
  @IsString()
  additionalNotes?: string;
}

export class CreatePetDto extends UpdatePetDto {}

export function validateAgeFields(dto: UpdatePetDto): string | null {
  if (dto.birthDate && dto.approximateAge) {
    return 'فقط یکی از تاریخ تولد یا سن تقریبی را وارد کنید';
  }
  return null;
}
