import { BadRequestException } from '@nestjs/common';
import {
  SetVetWorkingDayDto,
  ShiftDto,
  VetWorkingDayResponseDto,
} from '../../modules/vets/dto/vet-working-hours.dto';

/** The weekly-schedule columns shared by vet and clinic working-hour rows. */
export interface WorkingHourColumns {
  isActive: boolean;
  morningEnabled: boolean;
  morningStart: string | null;
  morningEnd: string | null;
  morningMaxAppointments: number | null;
  eveningEnabled: boolean;
  eveningStart: string | null;
  eveningEnd: string | null;
  eveningMaxAppointments: number | null;
}

export const DAYS_IN_WEEK = 7;

/** Persian weekday names, Saturday first (matches `dayOfWeek`). */
export const WEEKDAY_NAMES = [
  'شنبه',
  'یکشنبه',
  'دوشنبه',
  'سه‌شنبه',
  'چهارشنبه',
  'پنج‌شنبه',
  'جمعه',
];

function validateShift(shift: ShiftDto, label: string): void {
  if (!shift.enabled) return;
  if (!shift.startTime || !shift.endTime) {
    throw new BadRequestException(`ساعت شروع و پایان ${label} الزامی است`);
  }
  if (shift.startTime >= shift.endTime) {
    throw new BadRequestException(
      `ساعت شروع ${label} باید قبل از ساعت پایان باشد`,
    );
  }
}

/** Validates a day's shifts and converts them to row columns. */
export function toWorkingHourColumns(
  dto: SetVetWorkingDayDto,
): WorkingHourColumns {
  validateShift(dto.morning, 'شیفت صبح');
  validateShift(dto.evening, 'شیفت عصر');
  if (
    dto.morning.enabled &&
    dto.evening.enabled &&
    dto.morning.endTime! > dto.evening.startTime!
  ) {
    throw new BadRequestException(
      'شیفت‌های صبح و عصر نباید هم‌پوشانی داشته باشند',
    );
  }

  const { morning, evening } = dto;
  return {
    isActive: dto.isActive,
    morningEnabled: morning.enabled,
    morningStart: morning.enabled ? morning.startTime! : null,
    morningEnd: morning.enabled ? morning.endTime! : null,
    morningMaxAppointments: morning.enabled
      ? (morning.maxAppointments ?? null)
      : null,
    eveningEnabled: evening.enabled,
    eveningStart: evening.enabled ? evening.startTime! : null,
    eveningEnd: evening.enabled ? evening.endTime! : null,
    eveningMaxAppointments: evening.enabled
      ? (evening.maxAppointments ?? null)
      : null,
  };
}

export function toWorkingDayResponse(
  dayOfWeek: number,
  row?: WorkingHourColumns,
): VetWorkingDayResponseDto {
  const morning = {
    enabled: row?.morningEnabled ?? false,
    startTime: row?.morningStart ?? null,
    endTime: row?.morningEnd ?? null,
    maxAppointments: row?.morningMaxAppointments ?? null,
  };
  const evening = {
    enabled: row?.eveningEnabled ?? false,
    startTime: row?.eveningStart ?? null,
    endTime: row?.eveningEnd ?? null,
    maxAppointments: row?.eveningMaxAppointments ?? null,
  };
  const isActive = row?.isActive ?? false;
  const shifts = Number(morning.enabled) + Number(evening.enabled);

  return {
    dayOfWeek,
    isActive,
    state:
      !isActive || shifts === 0 ? 'off' : shifts === 2 ? 'active' : 'half_day',
    morning,
    evening,
  };
}
