import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
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
import { trim } from '../../../common/utils/transform';
import { IsIranianPhone } from '../../../common/validators/is-iranian-phone.validator';
import { ClinicMemberType, ClinicPermission } from '../clinic-panel.constants';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

export class MemberShiftDto {
  @ApiProperty({ example: '09:00' })
  @Matches(TIME_PATTERN, { message: 'ساعت باید به صورت HH:mm باشد' })
  start: string;

  @ApiProperty({ example: '13:00' })
  @Matches(TIME_PATTERN, { message: 'ساعت باید به صورت HH:mm باشد' })
  end: string;
}

export class MemberWorkingDayDto {
  @ApiProperty({ minimum: 0, maximum: 6, description: '0 = Saturday' })
  @IsInt()
  @Min(0)
  @Max(6)
  dayOfWeek: number;

  @ApiProperty()
  @IsBoolean()
  isClosed: boolean;

  @ApiProperty({
    type: [MemberShiftDto],
    description: 'Morning/evening shifts',
  })
  @IsArray()
  @ArrayMaxSize(3)
  @ValidateNested({ each: true })
  @Type(() => MemberShiftDto)
  shifts: MemberShiftDto[];
}

export class InviteMemberDto {
  @ApiProperty({ example: 'دکتر سارا احمدی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام الزامی است' })
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

  @ApiProperty({ enum: ClinicMemberType })
  @IsEnum(ClinicMemberType)
  memberType: ClinicMemberType;

  @ApiPropertyOptional({ description: 'Required when memberType is vet' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(50)
  medicalCouncilNumber?: string;

  @ApiPropertyOptional({ example: 'جراحی عمومی' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  primarySpecialty?: string;

  @ApiPropertyOptional({ description: 'Clinic role (permissions)' })
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional({ example: 'دامپزشک ارشد' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;
}

export class AddExistingMemberDto {
  @ApiProperty({ example: '09123456789', description: 'A registered vet' })
  @Transform(trim)
  @IsIranianPhone()
  phoneNumber: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  roleId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;
}

export class UpdateMemberDto {
  @ApiPropertyOptional({ nullable: true })
  @IsOptional()
  @IsUUID()
  roleId?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  jobTitle?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ type: [MemberWorkingDayDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(7)
  @ValidateNested({ each: true })
  @Type(() => MemberWorkingDayDto)
  workingHours?: MemberWorkingDayDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Clinic service ids this member provides',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ArrayUnique()
  @IsUUID('all', { each: true })
  serviceIds?: string[];
}

export class CreateRoleDto {
  @ApiProperty({ example: 'دامپزشک' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام نقش الزامی است' })
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ example: '#7C3AED' })
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'رنگ باید به صورت #RRGGBB باشد' })
  color?: string;

  @ApiProperty({ enum: ClinicPermission, isArray: true })
  @IsArray()
  @ArrayUnique()
  @IsEnum(ClinicPermission, { each: true })
  permissions: ClinicPermission[];
}

export class UpdateRoleDto {
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @Matches(/^#[0-9a-fA-F]{6}$/, { message: 'رنگ باید به صورت #RRGGBB باشد' })
  color?: string;

  @ApiPropertyOptional({ enum: ClinicPermission, isArray: true })
  @IsOptional()
  @IsArray()
  @ArrayUnique()
  @IsEnum(ClinicPermission, { each: true })
  permissions?: ClinicPermission[];
}

export class RoleMemberDto {
  @ApiProperty({ description: 'ClinicMember id' })
  @IsUUID()
  memberId: string;
}
