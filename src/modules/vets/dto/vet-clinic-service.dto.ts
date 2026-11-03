import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../../common/utils/transform';

export class CreateVetClinicServiceDto {
  @ApiProperty({ example: 'ویزیت و چکاپ کامل حیوانی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'نام خدمت الزامی است' })
  @MaxLength(150)
  name: string;

  @ApiProperty({ example: 'عمومی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'دسته‌بندی الزامی است' })
  @MaxLength(100)
  category: string;

  @ApiProperty({ example: 450000, description: 'Base price in tomans' })
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(2_000_000_000)
  basePrice: number;

  @ApiProperty({ example: 30, description: 'Duration in minutes' })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1440)
  durationMinutes: number;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(2000)
  description?: string;
}

export class UpdateVetClinicServiceDto extends PartialType(
  CreateVetClinicServiceDto,
) {}

export class VetClinicServiceResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty() category: string;
  @ApiProperty() basePrice: number;
  @ApiProperty() durationMinutes: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true }) description: string | null;
  @ApiProperty() createdAt: Date;
}
