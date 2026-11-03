import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsDateString,
  IsEmail,
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PersonGender } from '../../../common/enums/person-gender.enum';
import { trim } from '../../../common/utils/transform';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';
import { NotificationPreferencesDto } from '../../users/dto/update-admin-user.dto';

const trimEach = ({ value }: { value: unknown }) =>
  Array.isArray(value)
    ? value.map((item: unknown) =>
        typeof item === 'string' ? item.trim() : item,
      )
    : value;

export class CreateVetDto {
  @ApiProperty({ example: 'دکتر نرگس احمدی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام و نام خانوادگی الزامی است' })
  @MaxLength(100)
  fullName: string;

  @ApiProperty({ example: '09123456789' })
  @Transform(trim)
  @IsIranianPhone()
  @IsNotEmpty({ message: 'شماره موبایل الزامی است' })
  phoneNumber: string;

  @ApiProperty({ example: '123456' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شماره نظام دامپزشکی الزامی است' })
  @MaxLength(50)
  medicalCouncilNumber: string;

  @ApiProperty({ example: 'تهران' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'شهر الزامی است' })
  @MaxLength(100)
  city: string;

  @ApiProperty({ example: 'جراحی و بافت نرم' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'تخصص الزامی است' })
  @MaxLength(100)
  primarySpecialty: string;

  @ApiPropertyOptional({ example: 'n.ahmadi@example.com' })
  @IsOptional()
  @Transform(trim)
  @IsEmail({}, { message: 'ایمیل معتبر نیست' })
  email?: string;

  @ApiPropertyOptional({ example: '1234567890' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^\d{10}$/, { message: 'کد ملی باید ۱۰ رقم باشد' })
  nationalCode?: string;

  @ApiPropertyOptional({ enum: PersonGender })
  @IsOptional()
  @IsEnum(PersonGender)
  gender?: PersonGender;

  @ApiPropertyOptional({ example: '1988-08-09' })
  @IsOptional()
  @IsDateString({}, { message: 'تاریخ تولد معتبر نیست' })
  dateOfBirth?: string;

  @ApiPropertyOptional({ description: 'درباره دامپزشک' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  bio?: string;

  @ApiPropertyOptional({ type: [String], example: ['مراقبت ویژه'] })
  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  subSpecialties?: string[];

  @ApiPropertyOptional({ example: 'دکتری حرفه‌ای دامپزشکی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  highestDegree?: string;

  @ApiPropertyOptional({ example: 'دانشگاه تهران' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  university?: string;

  @ApiPropertyOptional({ example: 1394, description: 'Jalali year' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1300)
  @Max(2100)
  graduationYear?: number;

  @ApiPropertyOptional({ type: [String], example: ['فارسی', 'انگلیسی'] })
  @IsOptional()
  @Transform(trimEach)
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  languages?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Registered clinic the vet works at (send null to unlink); when set, its name, phone and address replace the free-text clinic fields',
  })
  @IsOptional()
  @IsUUID()
  clinicId?: string | null;

  @ApiPropertyOptional({ example: 'کلینیک دامپزشکی پت لند' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(150)
  clinicName?: string;

  @ApiPropertyOptional({ example: '02112345678' })
  @IsOptional()
  @Transform(trim)
  @Matches(/^[0-9+\-\s]{5,20}$/, { message: 'شماره تلفن کلینیک معتبر نیست' })
  clinicPhone?: string;

  @ApiPropertyOptional({ example: 'تهران، سعادت‌آباد، بلوار پاک نژاد' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(500)
  clinicAddress?: string;

  @ApiPropertyOptional({ example: 'dr.narges_ahmadi' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  instagram?: string;

  @ApiPropertyOptional({ example: 'dr_n_ahmadi' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  telegram?: string;

  @ApiPropertyOptional({ example: 'linkedin.com/in/narges-ahmadi' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(200)
  linkedin?: string;

  @ApiPropertyOptional({
    type: NotificationPreferencesDto,
    description:
      'newsletter = system updates, messageAlerts = new messages, reservationAlerts = new appointments',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => NotificationPreferencesDto)
  notificationPreferences?: NotificationPreferencesDto;
}
