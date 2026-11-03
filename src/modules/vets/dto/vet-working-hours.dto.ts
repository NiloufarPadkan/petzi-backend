import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsInt,
  IsOptional,
  Matches,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;
const TIME_MESSAGE = 'ساعت باید با قالب HH:mm باشد';

export class ShiftDto {
  @ApiProperty()
  @IsBoolean()
  enabled: boolean;

  @ApiProperty({ example: '08:00', required: false })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: TIME_MESSAGE })
  startTime?: string;

  @ApiProperty({ example: '12:00', required: false })
  @IsOptional()
  @Matches(TIME_PATTERN, { message: TIME_MESSAGE })
  endTime?: string;

  @ApiProperty({ example: 15, required: false })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(500)
  maxAppointments?: number;
}

export class SetVetWorkingDayDto {
  @ApiProperty({ description: 'Whether the vet works on this day at all' })
  @IsBoolean()
  isActive: boolean;

  @ApiProperty({ type: ShiftDto })
  @ValidateNested()
  @Type(() => ShiftDto)
  morning: ShiftDto;

  @ApiProperty({ type: ShiftDto })
  @ValidateNested()
  @Type(() => ShiftDto)
  evening: ShiftDto;
}

export class ShiftResponseDto {
  @ApiProperty() enabled: boolean;
  @ApiProperty({ nullable: true }) startTime: string | null;
  @ApiProperty({ nullable: true }) endTime: string | null;
  @ApiProperty({ nullable: true }) maxAppointments: number | null;
}

export class VetWorkingDayResponseDto {
  @ApiProperty({ description: '0 = Saturday … 6 = Friday' })
  dayOfWeek: number;

  @ApiProperty() isActive: boolean;

  @ApiProperty({
    enum: ['active', 'half_day', 'off'],
    description: 'active = both shifts, half_day = one shift, off = closed',
  })
  state: 'active' | 'half_day' | 'off';

  @ApiProperty({ type: ShiftResponseDto }) morning: ShiftResponseDto;
  @ApiProperty({ type: ShiftResponseDto }) evening: ShiftResponseDto;
}
