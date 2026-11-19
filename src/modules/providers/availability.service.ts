import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Between, In, Repository } from 'typeorm';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import {
  addDays,
  tehranDayRange,
  tehranToday,
} from '../../common/utils/tehran-time';
import { ClinicMember } from '../clinic-panel/entities/clinic-member.entity';
import { ClinicWorkingHour } from '../clinics/entities/clinic-working-hour.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import { VetWorkingHour } from '../vets/entities/vet-working-hour.entity';

export const DEFAULT_SLOT_MINUTES = 30;
const DEFAULT_CUTOFF_HOURS = 1;
const MAX_DAYS = 31;
const NEXT_SLOT_SEARCH_DAYS = 14;
const ACTIVE_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

export interface ScheduleShift {
  start: string;
  end: string;
  /** Cap on bookings starting inside the shift (null = unlimited). */
  max: number | null;
}

export interface VetSchedule {
  source: 'vet' | 'member' | 'clinic' | 'none';
  /** dayOfWeek (0 = Saturday … 6 = Friday) → shifts. */
  days: Map<number, ScheduleShift[]>;
  cutoffHours: number;
}

export interface DaySlots {
  date: string;
  dayOfWeek: number;
  slots: { startsAt: string; endsAt: string }[];
}

type HourColumns = Pick<
  VetWorkingHour,
  | 'isActive'
  | 'morningEnabled'
  | 'morningStart'
  | 'morningEnd'
  | 'morningMaxAppointments'
  | 'eveningEnabled'
  | 'eveningStart'
  | 'eveningEnd'
  | 'eveningMaxAppointments'
>;

/** Iranian week index (0 = Saturday) for a Tehran calendar date. */
export function iranianWeekday(ymd: string): number {
  const jsDay = new Date(`${ymd}T12:00:00+03:30`).getUTCDay();
  return (jsDay + 1) % 7;
}

const atTehran = (ymd: string, time: string) =>
  new Date(`${ymd}T${time}:00+03:30`);

@Injectable()
export class AvailabilityService {
  constructor(
    @InjectRepository(VetProfile)
    private readonly vetsRepository: Repository<VetProfile>,
    @InjectRepository(VetWorkingHour)
    private readonly vetHoursRepository: Repository<VetWorkingHour>,
    @InjectRepository(ClinicWorkingHour)
    private readonly clinicHoursRepository: Repository<ClinicWorkingHour>,
    @InjectRepository(ClinicMember)
    private readonly membersRepository: Repository<ClinicMember>,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
  ) {}

  /** Free slots per day, starting today (or `from`) for `days` days. */
  async getSlots(
    vetId: string,
    options: { from?: string; days?: number; durationMinutes?: number } = {},
  ): Promise<DaySlots[]> {
    const today = tehranToday();
    const from = options.from && options.from >= today ? options.from : today;
    const days = Math.min(Math.max(options.days ?? 7, 1), MAX_DAYS);
    const duration = options.durationMinutes ?? DEFAULT_SLOT_MINUTES;

    const schedule = await this.getSchedule(vetId);
    const rangeStart = tehranDayRange(from).start;
    const rangeEnd = tehranDayRange(addDays(from, days - 1)).end;
    const booked =
      schedule.source === 'none'
        ? []
        : await this.reservationsRepository.find({
            where: {
              vetId,
              status: In(ACTIVE_STATUSES),
              scheduledAt: Between(
                new Date(rangeStart.getTime() - 24 * 3_600_000),
                rangeEnd,
              ),
            },
            select: { id: true, scheduledAt: true, durationMinutes: true },
          });

    const earliest = new Date(Date.now() + schedule.cutoffHours * 3_600_000);
    const result: DaySlots[] = [];

    for (let i = 0; i < days; i++) {
      const date = addDays(from, i);
      const dayOfWeek = iranianWeekday(date);
      const slots: DaySlots['slots'] = [];

      for (const shift of schedule.days.get(dayOfWeek) ?? []) {
        const shiftStart = atTehran(date, shift.start);
        const shiftEnd = atTehran(date, shift.end);
        if (shift.max !== null) {
          const used = booked.filter(
            (r) => r.scheduledAt >= shiftStart && r.scheduledAt < shiftEnd,
          ).length;
          if (used >= shift.max) continue;
        }
        for (
          let start = shiftStart;
          start.getTime() + duration * 60_000 <= shiftEnd.getTime();
          start = new Date(start.getTime() + duration * 60_000)
        ) {
          const end = new Date(start.getTime() + duration * 60_000);
          if (start < earliest) continue;
          const clashes = booked.some(
            (r) =>
              r.scheduledAt < end &&
              new Date(r.scheduledAt.getTime() + r.durationMinutes * 60_000) >
                start,
          );
          if (!clashes) {
            slots.push({
              startsAt: start.toISOString(),
              endsAt: end.toISOString(),
            });
          }
        }
      }
      result.push({ date, dayOfWeek, slots });
    }
    return result;
  }

  /** Throws unless `startsAt` is one of the vet's currently free slots. */
  async assertSlotAvailable(
    vetId: string,
    startsAt: Date,
    durationMinutes: number,
  ): Promise<void> {
    const date = startsAt.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tehran',
    });
    const [day] = await this.getSlots(vetId, {
      from: date,
      days: 1,
      durationMinutes,
    });
    const wanted = startsAt.toISOString();
    if (!day?.slots.some((slot) => slot.startsAt === wanted)) {
      throw new BadRequestException('این زمان دیگر در دسترس نیست');
    }
  }

  async nextAvailable(
    vetId: string,
    durationMinutes = DEFAULT_SLOT_MINUTES,
  ): Promise<string | null> {
    const days = await this.getSlots(vetId, {
      days: NEXT_SLOT_SEARCH_DAYS,
      durationMinutes,
    });
    return days.find((day) => day.slots.length > 0)?.slots[0].startsAt ?? null;
  }

  /**
   * A vet's own weekly hours win; otherwise the hours the clinic gave the
   * member; otherwise the clinic's opening hours.
   */
  async getSchedule(vetId: string): Promise<VetSchedule> {
    const profile = await this.vetsRepository.findOne({
      where: { userId: vetId },
      select: { userId: true, clinicId: true },
    });
    const clinic = profile?.clinicId
      ? await this.clinicsRepository.findOne({
          where: { userId: profile.clinicId },
          select: { userId: true, bookingCutoffHours: true },
        })
      : null;
    const cutoffHours = clinic?.bookingCutoffHours ?? DEFAULT_CUTOFF_HOURS;

    const vetRows = (
      await this.vetHoursRepository.find({ where: { vetId } })
    ).filter((row) => row.isActive);
    if (vetRows.length > 0) {
      return { source: 'vet', days: this.fromRows(vetRows), cutoffHours };
    }

    const member = await this.membersRepository.findOne({
      where: { userId: vetId, isActive: true },
    });
    const memberDays = new Map<number, ScheduleShift[]>();
    for (const day of member?.workingHours ?? []) {
      if (day.isClosed) continue;
      memberDays.set(
        day.dayOfWeek,
        day.shifts.map((shift) => ({ ...shift, max: null })),
      );
    }
    if (memberDays.size > 0) {
      return { source: 'member', days: memberDays, cutoffHours };
    }

    if (profile?.clinicId) {
      const clinicRows = (
        await this.clinicHoursRepository.find({
          where: { clinicId: profile.clinicId },
        })
      ).filter((row) => row.isActive);
      if (clinicRows.length > 0) {
        return {
          source: 'clinic',
          days: this.fromRows(clinicRows),
          cutoffHours,
        };
      }
    }
    return { source: 'none', days: new Map(), cutoffHours };
  }

  private fromRows(rows: (HourColumns & { dayOfWeek: number })[]) {
    const days = new Map<number, ScheduleShift[]>();
    for (const row of rows) {
      const shifts: ScheduleShift[] = [];
      if (row.morningEnabled && row.morningStart && row.morningEnd) {
        shifts.push({
          start: row.morningStart,
          end: row.morningEnd,
          max: row.morningMaxAppointments,
        });
      }
      if (row.eveningEnabled && row.eveningStart && row.eveningEnd) {
        shifts.push({
          start: row.eveningStart,
          end: row.eveningEnd,
          max: row.eveningMaxAppointments,
        });
      }
      if (shifts.length > 0) days.set(row.dayOfWeek, shifts);
    }
    return days;
  }
}
