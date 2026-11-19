import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import {
  ClinicActivityStatus,
  ClinicVerificationStatus,
} from '../../../common/enums/clinic-enums';
import { trim } from '../../../common/utils/transform';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';

const LANDLINE_PATTERN = /^[0-9+\-\s]{5,20}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class CreateOrganizationDto {
  @ApiProperty({ example: 'پت‌شاپ مهربان' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'علی رضایی', description: 'Account manager name' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام مدیر الزامی است' })
  @MaxLength(100)
  managerName: string;

  @ApiProperty({
    example: '09123456789',
    description: 'Manager mobile; used to sign in',
  })
  @Transform(trim)
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل مدیر الزامی است' })
  managerPhone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiProperty({ example: '02188221100' })
  @Transform(trim)
  @Matches(LANDLINE_PATTERN, { message: 'شماره تماس معتبر نیست' })
  phone: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @Matches(LANDLINE_PATTERN, { message: 'شماره تماس معتبر نیست' })
  secondaryPhone?: string;

  @ApiProperty({ example: 'تهران' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'استان الزامی است' })
  @MaxLength(100)
  province: string;

  @ApiProperty({ example: 'تهران' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شهر الزامی است' })
  @MaxLength(100)
  city: string;

  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'آدرس الزامی است' })
  @MaxLength(500)
  address: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  about?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  licenseNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  website?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  instagram?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-90)
  @Max(90)
  latitude?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(-180)
  @Max(180)
  longitude?: number;

  @ApiPropertyOptional({ description: 'Shelters only' })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100000)
  capacity?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(3000)
  adminNotes?: string;
}

export class UpdateOrganizationDto extends PartialType(CreateOrganizationDto) {}

export class ChangeOrganizationStatusDto {
  @ApiPropertyOptional({ enum: ClinicVerificationStatus })
  @IsOptional()
  @IsEnum(ClinicVerificationStatus)
  verificationStatus?: ClinicVerificationStatus;

  @ApiPropertyOptional({ enum: ClinicActivityStatus })
  @IsOptional()
  @IsEnum(ClinicActivityStatus)
  activityStatus?: ClinicActivityStatus;

  @ApiPropertyOptional({ description: 'Shown to the account owner' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class QueryOrganizationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Name, manager, phone or email' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  province?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  city?: string;

  @ApiPropertyOptional({ enum: ClinicVerificationStatus })
  @IsOptional()
  @IsEnum(ClinicVerificationStatus)
  verificationStatus?: ClinicVerificationStatus;

  @ApiPropertyOptional({ enum: ClinicActivityStatus })
  @IsOptional()
  @IsEnum(ClinicActivityStatus)
  activityStatus?: ClinicActivityStatus;
}

export class ShiftDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty({ example: '09:00' })
  @Matches(TIME_PATTERN, { message: 'ساعت باید به صورت HH:mm باشد' })
  opensAt: string;

  @ApiProperty({ example: '18:00' })
  @Matches(TIME_PATTERN, { message: 'ساعت باید به صورت HH:mm باشد' })
  closesAt: string;

  @ApiProperty()
  @IsBoolean()
  isClosed: boolean;
}

export class SetShiftsDto {
  @ApiProperty({ type: [ShiftDto] })
  @IsArray()
  @ArrayMaxSize(21)
  @ValidateNested({ each: true })
  @Type(() => ShiftDto)
  shifts: ShiftDto[];
}

export class SetCategoriesDto {
  @ApiProperty({ type: [String], example: ['غذای سگ', 'لوازم گربه'] })
  @IsArray()
  @ArrayMaxSize(100)
  @Transform(({ value }: { value: unknown }): unknown =>
    Array.isArray(value)
      ? (value as unknown[]).map((item) =>
          typeof item === 'string' ? item.trim() : item,
        )
      : value,
  )
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  @MaxLength(100, { each: true })
  categories: string[];
}

export class ServiceItemDto {
  @ApiProperty()
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام خدمت الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;
}

export class UpdateServiceItemDto extends PartialType(ServiceItemDto) {}

export class AnimalDto {
  @ApiProperty({ example: 'بوبی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام حیوان الزامی است' })
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: 'سگ' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'گونه الزامی است' })
  @MaxLength(50)
  species: string;

  @ApiPropertyOptional({ example: '۲ ساله' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  age?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(20)
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  description?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isAdopted?: boolean;
}

export class UpdateAnimalDto extends PartialType(AnimalDto) {}
