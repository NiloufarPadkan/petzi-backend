import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PetStatus } from '../../../common/enums/pet-status.enum';
import { PetType } from '../../../common/enums/pet-type.enum';
import { PetGender } from '../../../common/enums/pet-gender.enum';
import { ApproximateAge } from '../../../common/enums/approximate-age.enum';
import { HealthStatus } from '../../../common/enums/health-status.enum';
import { VaccinationStatus } from '../../../common/enums/vaccination-status.enum';
import { FoodType } from '../../../common/enums/food-type.enum';
import { MealsPerDay } from '../../../common/enums/meals-per-day.enum';

export class PetVaccineResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'Rabies' })
  vaccineName: string;

  @ApiProperty({ example: '2024-06-01' })
  vaccineDate: string;
}

export class PetDocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'vaccine-card.pdf' })
  originalName: string;

  @ApiProperty({ example: '/uploads/pet-documents/abc.pdf' })
  fileUrl: string;

  @ApiProperty({ example: 'application/pdf' })
  mimeType: string;

  @ApiProperty({ example: 102400 })
  sizeBytes: number;
}

export class PetResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ enum: PetStatus, example: PetStatus.DRAFT })
  status: PetStatus;

  @ApiPropertyOptional({ example: 'پشمک' })
  name?: string;

  @ApiPropertyOptional({ enum: PetType, example: PetType.CAT })
  type?: PetType;

  @ApiPropertyOptional({ example: 'گربه' })
  typeLabel?: string;

  @ApiPropertyOptional({ example: 'Persian' })
  breed?: string;

  @ApiPropertyOptional({ enum: PetGender, example: PetGender.FEMALE })
  gender?: PetGender;

  @ApiPropertyOptional({ example: '2022-03-21' })
  birthDate?: string;

  @ApiPropertyOptional({ enum: ApproximateAge })
  approximateAge?: ApproximateAge;

  @ApiPropertyOptional({ example: '۲ سال' })
  ageLabel?: string;

  @ApiPropertyOptional({ example: 'white' })
  color?: string;

  @ApiPropertyOptional()
  appearanceFeatures?: string;

  @ApiPropertyOptional({ example: 8.4 })
  weight?: number;

  @ApiPropertyOptional({ example: 45 })
  height?: number;

  @ApiPropertyOptional({ enum: HealthStatus })
  healthStatus?: HealthStatus;

  @ApiPropertyOptional({ example: 'None' })
  underlyingDiseases?: string;

  @ApiPropertyOptional({ example: 'None' })
  allergies?: string;

  @ApiPropertyOptional({ example: 'None' })
  medications?: string;

  @ApiPropertyOptional()
  healthNotes?: string;

  @ApiPropertyOptional({ enum: VaccinationStatus })
  vaccinationStatus?: VaccinationStatus;

  @ApiPropertyOptional({ example: '2025-01-15' })
  lastDewormingDate?: string;

  @ApiPropertyOptional()
  dewormingType?: string;

  @ApiPropertyOptional({ type: [PetVaccineResponseDto] })
  vaccines?: PetVaccineResponseDto[];

  @ApiPropertyOptional({ enum: FoodType })
  foodType?: FoodType;

  @ApiPropertyOptional({ example: 'Royal Canin' })
  foodBrand?: string;

  @ApiPropertyOptional({ enum: MealsPerDay })
  mealsPerDay?: MealsPerDay;

  @ApiPropertyOptional({ example: 'None' })
  foodSensitivities?: string;

  @ApiPropertyOptional({ example: 'None' })
  surgeries?: string;

  @ApiPropertyOptional({ example: 'None' })
  previousDiseases?: string;

  @ApiPropertyOptional({ example: 'None' })
  hospitalizations?: string;

  @ApiPropertyOptional()
  additionalNotes?: string;

  @ApiPropertyOptional({ type: [PetDocumentResponseDto] })
  documents?: PetDocumentResponseDto[];

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class PetUpdateResponseDto {
  @ApiProperty({ example: 'اطلاعات ذخیره شد' })
  message: string;

  @ApiProperty({ type: PetResponseDto })
  pet: PetResponseDto;
}

export class PetSubmitResponseDto {
  @ApiProperty({ example: 'ثبت حیوان خانگی با موفقیت انجام شد' })
  message: string;

  @ApiProperty({
    type: PetResponseDto,
    description: 'Summary after successful submit',
  })
  pet: PetResponseDto;
}

export class PetVaccineCreateResponseDto {
  @ApiProperty({ example: 'واکسن اضافه شد' })
  message: string;

  @ApiProperty({ type: PetVaccineResponseDto })
  vaccine: PetVaccineResponseDto;
}

export class PetDocumentsUploadResponseDto {
  @ApiProperty({ example: 'فایل‌ها با موفقیت آپلود شدند' })
  message: string;

  @ApiProperty({ type: [PetDocumentResponseDto] })
  documents: PetDocumentResponseDto[];
}

export class PetDeleteResponseDto {
  @ApiProperty({ example: 'پیش‌نویس حذف شد' })
  message: string;
}
