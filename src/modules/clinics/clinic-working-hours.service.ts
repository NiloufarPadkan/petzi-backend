import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicLogType } from '../../common/enums/clinic-enums';
import {
  DAYS_IN_WEEK,
  WEEKDAY_NAMES,
  toWorkingDayResponse,
  toWorkingHourColumns,
} from '../../common/utils/working-hours';
import {
  SetVetWorkingDayDto,
  VetWorkingDayResponseDto,
} from '../vets/dto/vet-working-hours.dto';
import { ClinicWorkingHour } from './entities/clinic-working-hour.entity';
import { ClinicsService } from './clinics.service';

@Injectable()
export class ClinicWorkingHoursService {
  constructor(
    @InjectRepository(ClinicWorkingHour)
    private readonly hoursRepository: Repository<ClinicWorkingHour>,
    private readonly clinicsService: ClinicsService,
  ) {}

  /** Always returns all seven days; days never configured are closed. */
  async findAll(clinicId: string): Promise<VetWorkingDayResponseDto[]> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const rows = await this.hoursRepository.find({ where: { clinicId } });
    const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));

    return Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
      toWorkingDayResponse(day, byDay.get(day)),
    );
  }

  async setDay(
    clinicId: string,
    dayOfWeek: number,
    dto: SetVetWorkingDayDto,
    actorId: string,
  ): Promise<VetWorkingDayResponseDto> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const values = toWorkingHourColumns(dto);

    await this.hoursRepository.upsert({ clinicId, dayOfWeek, ...values }, [
      'clinicId',
      'dayOfWeek',
    ]);
    const row = await this.hoursRepository.findOneByOrFail({
      clinicId,
      dayOfWeek,
    });
    const response = toWorkingDayResponse(dayOfWeek, row);

    await this.clinicsService.addLog(
      clinicId,
      ClinicLogType.SCHEDULE_CHANGED,
      this.describe(response),
      actorId,
    );
    return response;
  }

  private describe(day: VetWorkingDayResponseDto): string {
    const name = WEEKDAY_NAMES[day.dayOfWeek];
    if (day.state === 'off') return `${name}: تعطیل`;
    const shifts = [
      day.morning.enabled
        ? `صبح ${day.morning.startTime}–${day.morning.endTime}`
        : null,
      day.evening.enabled
        ? `عصر ${day.evening.startTime}–${day.evening.endTime}`
        : null,
    ].filter(Boolean);
    return `${name}: ${shifts.join('، ')}`;
  }
}
