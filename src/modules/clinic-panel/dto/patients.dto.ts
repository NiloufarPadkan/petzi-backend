import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { PetGender } from '../../../common/enums/pet-gender.enum';
import { PetType } from '../../../common/enums/pet-type.enum';
import { trim } from '../../../common/utils/transform';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';

export class QueryPatientsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Pet name, owner name/phone, microchip' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: PetType })
  @IsOptional()
  @IsEnum(PetType)
  type?: PetType;

  @ApiPropertyOptional({ description: 'Primary vet account UUID' })
  @IsOptional()
  @IsUUID()
  vetId?: string;
}

export class PatientPetDto {
  @ApiProperty({ example: 'میشو' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام پت الزامی است' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ enum: PetType })
  @IsEnum(PetType)
  type: PetType;

  @ApiPropertyOptional({ example: 'پرشین' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  breed?: string;

  @ApiProperty({ enum: PetGender })
  @IsEnum(PetGender)
  gender: PetGender;

  @ApiPropertyOptional({ example: '2022-05-01' })
  @IsOptional()
  @IsDateString()
  birthDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  color?: string;

  @ApiPropertyOptional({ description: 'kg' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  weight?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  microchipNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  allergies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  underlyingDiseases?: string;
}

export class PatientOwnerDto {
  @ApiProperty({ example: 'سارا محمدی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام صاحب پت الزامی است' })
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '09123456789' })
  @Transform(trim)
  @IsIranianPhone()
  phoneNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;
}

export class AddPatientDto {
  @ApiPropertyOptional({
    description: 'An existing pet; omit to create the pet and owner below',
  })
  @ValidateIf((dto: AddPatientDto) => !dto.pet)
  @IsUUID()
  petId?: string;

  @ApiPropertyOptional({ type: PatientPetDto })
  @ValidateIf((dto: AddPatientDto) => !dto.petId)
  @ValidateNested()
  @Type(() => PatientPetDto)
  pet?: PatientPetDto;

  @ApiPropertyOptional({
    type: PatientOwnerDto,
    description: 'Required with `pet`; found by phone or created',
  })
  @ValidateIf((dto: AddPatientDto) => !dto.petId)
  @ValidateNested()
  @Type(() => PatientOwnerDto)
  owner?: PatientOwnerDto;

  @ApiPropertyOptional({ description: 'Primary vet account UUID' })
  @IsOptional()
  @IsUUID()
  vetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  medicalNotes?: string;
}

export class UpdatePatientDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  vetId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(5000)
  medicalNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(30)
  microchipNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  allergies?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  underlyingDiseases?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  medications?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  weight?: number;
}

export class PrescriptionDto {
  @ApiProperty({ example: 'پنی‌سیلین' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional({ example: '۲ بار در روز' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  dosage?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  instructions?: string;
}

export class CreateRecordDto {
  @ApiPropertyOptional({ example: 'ct_scan', default: 'visit' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  type?: string;

  @ApiProperty({ example: 'سی‌تی اسکن شکم' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'عنوان الزامی است' })
  @MaxLength(200)
  title: string;

  @ApiProperty({ example: '2026-12-01T10:00:00.000Z' })
  @IsDateString()
  recordedAt: string;

  @ApiPropertyOptional({ description: 'Vet account UUID' })
  @IsOptional()
  @IsUUID()
  vetId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  result?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(10000)
  aiSummary?: string;

  @ApiPropertyOptional({ type: [PrescriptionDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => PrescriptionDto)
  prescriptions?: PrescriptionDto[];
}

export class UpdateRecordDto extends PartialType(CreateRecordDto) {}
