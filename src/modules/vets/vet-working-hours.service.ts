import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  DAYS_IN_WEEK,
  toWorkingDayResponse,
  toWorkingHourColumns,
} from '../../common/utils/working-hours';
import {
  SetVetWorkingDayDto,
  VetWorkingDayResponseDto,
} from './dto/vet-working-hours.dto';
import { VetWorkingHour } from './entities/vet-working-hour.entity';
import { VetsService } from './vets.service';

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
      toWorkingDayResponse(day, byDay.get(day)),
    );
  }

  async setDay(
    vetId: string,
    dayOfWeek: number,
    dto: SetVetWorkingDayDto,
  ): Promise<VetWorkingDayResponseDto> {
    await this.vetsService.getVetOrThrow(vetId);
    const values = toWorkingHourColumns(dto);

    await this.hoursRepository.upsert({ vetId, dayOfWeek, ...values }, [
      'vetId',
      'dayOfWeek',
    ]);
    const row = await this.hoursRepository.findOneByOrFail({
      vetId,
      dayOfWeek,
    });
    return toWorkingDayResponse(dayOfWeek, row);
  }
}
