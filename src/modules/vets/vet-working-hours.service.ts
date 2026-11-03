import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  SetVetWorkingDayDto,
  ShiftDto,
  VetWorkingDayResponseDto,
} from './dto/vet-working-hours.dto';
import { VetWorkingHour } from './entities/vet-working-hour.entity';
import { VetsService } from './vets.service';

const DAYS_IN_WEEK = 7;

@Injectable()
export class VetWorkingHoursService {
  constructor(
    @InjectRepository(VetWorkingHour)
    private readonly hoursRepository: Repository<VetWorkingHour>,
    private readonly vetsService: VetsService,
  ) {}

  /** Always returns all seven days; days never configured are closed. */
  async findAll(vetId: string): Promise<VetWorkingDayResponseDto[]> {
    await this.vetsService.getVetOrThrow(vetId);
    const rows = await this.hoursRepository.find({ where: { vetId } });
    const byDay = new Map(rows.map((row) => [row.dayOfWeek, row]));

    return Array.from({ length: DAYS_IN_WEEK }, (_, day) =>
      this.toResponse(day, byDay.get(day)),
    );
  }

  async setDay(
    vetId: string,
    dayOfWeek: number,
    dto: SetVetWorkingDayDto,
  ): Promise<VetWorkingDayResponseDto> {
    await this.vetsService.getVetOrThrow(vetId);
    this.validateShift(dto.morning, 'شیفت صبح');
    this.validateShift(dto.evening, 'شیفت عصر');
    if (
      dto.morning.enabled &&
      dto.evening.enabled &&
      dto.morning.endTime! > dto.evening.startTime!
    ) {
      throw new BadRequestException(
        'شیفت‌های صبح و عصر نباید هم‌پوشانی داشته باشند',
      );
    }

    const values = {
      isActive: dto.isActive,
      morningEnabled: dto.morning.enabled,
      morningStart: dto.morning.enabled ? dto.morning.startTime! : null,
      morningEnd: dto.morning.enabled ? dto.morning.endTime! : null,
      morningMaxAppointments: dto.morning.enabled
        ? (dto.morning.maxAppointments ?? null)
        : null,
      eveningEnabled: dto.evening.enabled,
      eveningStart: dto.evening.enabled ? dto.evening.startTime! : null,
      eveningEnd: dto.evening.enabled ? dto.evening.endTime! : null,
      eveningMaxAppointments: dto.evening.enabled
        ? (dto.evening.maxAppointments ?? null)
        : null,
    };

    await this.hoursRepository.upsert({ vetId, dayOfWeek, ...values }, [
      'vetId',
      'dayOfWeek',
    ]);
    const row = await this.hoursRepository.findOneByOrFail({
      vetId,
      dayOfWeek,
    });
    return this.toResponse(dayOfWeek, row);
  }

  private validateShift(shift: ShiftDto, label: string): void {
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

  private toResponse(
    dayOfWeek: number,
    row?: VetWorkingHour,
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
        !isActive || shifts === 0
          ? 'off'
          : shifts === 2
            ? 'active'
            : 'half_day',
      morning,
      evening,
    };
  }
}
