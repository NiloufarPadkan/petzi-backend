import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DataSource } from 'typeorm';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import { NotificationType } from '../../common/enums/owner-app.enums';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { addDays, tehranToday } from '../../common/utils/tehran-time';
import { PetMedication } from '../pet-health/entities/pet-health.entities';
import { PetVaccine } from '../pets/entities/pet-vaccine.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { NotificationsService } from './notifications.service';

const BATCH_LIMIT = 1000;
const VACCINE_LEAD_DAYS = 7;

/**
 * Generates vaccine, medication, checkup and reservation reminders as in-app
 * notifications. It polls on a timer; the notification dedupe key makes every
 * reminder single-shot, so several server instances can run it safely.
 */
@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly dataSource: DataSource,
    private readonly configService: ConfigService,
    private readonly notificationsService: NotificationsService,
  ) {}

  onModuleInit(): void {
    if (!this.configService.get<boolean>('reminders.enabled')) return;
    const minutes =
      this.configService.get<number>('reminders.intervalMinutes') ?? 60;
    this.timer = setInterval(() => void this.runSafely(), minutes * 60_000);
    // Don't keep the process alive just for reminders.
    this.timer.unref();
  }

  onModuleDestroy(): void {
    if (this.timer) clearInterval(this.timer);
  }

  async runSafely(): Promise<void> {
    try {
      await this.generate();
    } catch (error) {
      this.logger.error(`Reminder run failed: ${(error as Error).message}`);
    }
  }

  async generate(): Promise<void> {
    await this.reservationReminders();
    await this.vaccineReminders();
    await this.medicationReminders();
    await this.checkupReminders();
  }

  private async reservationReminders(): Promise<void> {
    const now = new Date();
    const reservations = await this.dataSource
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .where('r.status IN (:...statuses)', {
        statuses: [ReservationStatus.PENDING, ReservationStatus.CONFIRMED],
      })
      .andWhere('r.scheduledAt > :now AND r.scheduledAt <= :soon', {
        now,
        soon: new Date(now.getTime() + 24 * 60 * 60 * 1000),
      })
      .take(BATCH_LIMIT)
      .getMany();
    for (const r of reservations) {
      await this.notificationsService.notify(r.ownerId, {
        type: NotificationType.RESERVATION,
        title: 'یادآوری نوبت',
        body: `نوبت «${r.serviceName}» شما کمتر از ۲۴ ساعت دیگر است.`,
        data: { reservationId: r.id },
        dedupeKey: `reservation-24h:${r.id}:${r.scheduledAt.toISOString()}`,
      });
    }
  }

  private async vaccineReminders(): Promise<void> {
    const today = tehranToday();
    const vaccines = await this.dataSource
      .getRepository(PetVaccine)
      .createQueryBuilder('v')
      .innerJoinAndSelect('v.pet', 'pet')
      .where('pet.status = :active', { active: PetStatus.ACTIVE })
      .andWhere('v.nextDueDate IS NOT NULL')
      .andWhere('v.nextDueDate <= :until AND v.nextDueDate >= :since', {
        until: addDays(today, VACCINE_LEAD_DAYS),
        since: addDays(today, -30),
      })
      .take(BATCH_LIMIT)
      .getMany();

    for (const v of vaccines) {
      const due = v.nextDueDate!;
      const overdue = due < today;
      await this.notificationsService.notify(v.pet.ownerId, {
        type: NotificationType.VACCINE_REMINDER,
        title: overdue ? 'واکسن عقب‌افتاده' : 'یادآوری واکسن',
        body: overdue
          ? `موعد واکسن «${v.vaccineName}» ${v.pet.name ?? 'پت شما'} گذشته است.`
          : `واکسن «${v.vaccineName}» ${v.pet.name ?? 'پت شما'} به‌زودی (${due}) موعد دارد.`,
        data: { petId: v.petId, vaccineId: v.id },
        dedupeKey: `vaccine:${v.id}:${due}:${overdue ? 'overdue' : 'soon'}`,
      });
    }
  }

  private async medicationReminders(): Promise<void> {
    const today = tehranToday();
    const medications = await this.dataSource
      .getRepository(PetMedication)
      .createQueryBuilder('m')
      .innerJoinAndSelect('m.pet', 'pet')
      .where('m.isActive = true')
      .andWhere('pet.status = :active', { active: PetStatus.ACTIVE })
      .andWhere('(m.startDate = :today OR m.endDate = :tomorrow)', {
        today,
        tomorrow: addDays(today, 1),
      })
      .take(BATCH_LIMIT)
      .getMany();

    for (const m of medications) {
      const starting = m.startDate === today;
      await this.notificationsService.notify(m.pet.ownerId, {
        type: NotificationType.MEDICATION_REMINDER,
        title: starting ? 'شروع دارو' : 'پایان دوره دارو',
        body: starting
          ? `امروز مصرف «${m.name}» برای ${m.pet.name ?? 'پت شما'} شروع می‌شود.`
          : `مصرف «${m.name}» ${m.pet.name ?? 'پت شما'} فردا به پایان می‌رسد.`,
        data: { petId: m.petId, medicationId: m.id },
        dedupeKey: `medication:${m.id}:${starting ? m.startDate : m.endDate}`,
      });
    }
  }

  /** At most one checkup nudge per pet per quarter. */
  private async checkupReminders(): Promise<void> {
    const today = tehranToday();
    const quarter = `${today.slice(0, 4)}-Q${Math.floor((Number(today.slice(5, 7)) - 1) / 3) + 1}`;
    const pets = await this.dataSource
      .getRepository(Pet)
      .createQueryBuilder('pet')
      .where('pet.status = :active', { active: PetStatus.ACTIVE })
      .andWhere(`pet.createdAt < now() - interval '30 days'`)
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM reservations r WHERE r."petId" = pet.id AND r.status = :completed AND r."scheduledAt" > now() - interval '365 days')`,
        { completed: ReservationStatus.COMPLETED },
      )
      .andWhere(
        `NOT EXISTS (SELECT 1 FROM pet_events e WHERE e."petId" = pet.id AND e.type = 'vet_visit' AND e."eventAt" > now() - interval '365 days')`,
      )
      .take(BATCH_LIMIT)
      .getMany();

    for (const pet of pets) {
      await this.notificationsService.notify(pet.ownerId, {
        type: NotificationType.CHECKUP_REMINDER,
        title: 'زمان چکاپ سالانه',
        body: `مدتی از آخرین ویزیت ${pet.name ?? 'پت شما'} می‌گذرد؛ یک نوبت چکاپ بگیرید.`,
        data: { petId: pet.id },
        dedupeKey: `checkup:${pet.id}:${quarter}`,
      });
    }
  }
}
