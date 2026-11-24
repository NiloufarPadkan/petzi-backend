import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { LessThan, Repository } from 'typeorm';
import { SurgeryStatus } from '../../common/enums/owner-app.enums';
import { decodeMultipartFilename } from '../../common/utils/multipart-filename';
import { addDays, tehranToday } from '../../common/utils/tehran-time';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { PetDocument } from '../pets/entities/pet-document.entity';
import { PetVaccine } from '../pets/entities/pet-vaccine.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import {
  CreateEventDto,
  CreateMedicationDto,
  CreateSurgeryDto,
  CreateWeightDto,
  TimelineQueryDto,
  UpdateEventDto,
  UpdateMedicationDto,
  UpdateSurgeryDto,
  UpdateVaccineDto,
  WeightsQueryDto,
} from './dto/pet-health.dto';
import {
  PetEvent,
  PetMedication,
  PetSurgery,
  PetWeight,
} from './entities/pet-health.entities';

export type TimelineKind =
  | 'reservation'
  | 'vaccine'
  | 'event'
  | 'weight'
  | 'surgery'
  | 'medication'
  | 'document';

export interface TimelineItem {
  kind: TimelineKind;
  id: string;
  at: Date;
  title: string;
  subtitle: string | null;
  data: Record<string, unknown>;
}

const RANGE_DAYS = { '1m': 30, '3m': 90, '6m': 183, '1y': 365 } as const;
const ALL_KINDS: TimelineKind[] = [
  'reservation',
  'vaccine',
  'event',
  'weight',
  'surgery',
  'medication',
  'document',
];

/** Date-only columns are anchored at Tehran midnight so they sort correctly. */
const atDate = (ymd: string) => new Date(`${ymd}T00:00:00+03:30`);

@Injectable()
export class PetHealthService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(PetWeight)
    private readonly weightsRepository: Repository<PetWeight>,
    @InjectRepository(PetEvent)
    private readonly eventsRepository: Repository<PetEvent>,
    @InjectRepository(PetMedication)
    private readonly medicationsRepository: Repository<PetMedication>,
    @InjectRepository(PetSurgery)
    private readonly surgeriesRepository: Repository<PetSurgery>,
    @InjectRepository(PetVaccine)
    private readonly vaccinesRepository: Repository<PetVaccine>,
    @InjectRepository(PetDocument)
    private readonly documentsRepository: Repository<PetDocument>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
  ) {}

  // ---- overview ----

  /** The "medical info" screen: status plus active medications, surgeries, vaccines. */
  async overview(ownerId: string, petId: string) {
    const pet = await this.getPet(ownerId, petId);
    const [medications, surgeries, vaccines, documents] = await Promise.all([
      this.medicationsRepository.find({
        where: { petId, isActive: true },
        order: { startDate: 'DESC' },
      }),
      this.surgeriesRepository.find({
        where: { petId },
        order: { surgeryDate: 'DESC' },
      }),
      this.vaccinesRepository.find({
        where: { petId },
        order: { vaccineDate: 'DESC' },
      }),
      this.documentsRepository.count({ where: { petId } }),
    ]);
    const today = tehranToday();
    return {
      healthStatus: pet.healthStatus,
      vaccinationStatus: pet.vaccinationStatus,
      underlyingDiseases: pet.underlyingDiseases,
      allergies: pet.allergies,
      weight: pet.weight,
      activeMedications: medications,
      surgeries,
      vaccines: vaccines.map((v) => ({
        ...v,
        isOverdue: v.nextDueDate !== null && v.nextDueDate < today,
      })),
      documentCount: documents,
    };
  }

  // ---- weights ----

  async listWeights(ownerId: string, petId: string, query: WeightsQueryDto) {
    await this.getPet(ownerId, petId);
    const qb = this.weightsRepository
      .createQueryBuilder('w')
      .where('w.petId = :petId', { petId })
      .orderBy('w.measuredAt', 'ASC')
      .addOrderBy('w.createdAt', 'ASC');
    if (query.range !== 'all') {
      qb.andWhere('w.measuredAt >= :since', {
        since: addDays(tehranToday(), -RANGE_DAYS[query.range]),
      });
    }
    const points = await qb.getMany();
    const values = points.map((p) => p.weightKg);
    const current = values.at(-1) ?? null;
    const first = values[0] ?? null;
    return {
      points: points.map((p) => ({
        id: p.id,
        weightKg: p.weightKg,
        measuredAt: p.measuredAt,
        note: p.note,
      })),
      stats: {
        current,
        changeKg:
          current !== null && first !== null
            ? Math.round((current - first) * 100) / 100
            : null,
        min: values.length ? Math.min(...values) : null,
        max: values.length ? Math.max(...values) : null,
        average: values.length
          ? Math.round(
              (values.reduce((a, b) => a + b, 0) / values.length) * 100,
            ) / 100
          : null,
      },
    };
  }

  async addWeight(ownerId: string, petId: string, dto: CreateWeightDto) {
    await this.getPet(ownerId, petId);
    const measuredAt = dto.measuredAt?.slice(0, 10) ?? tehranToday();
    if (measuredAt > tehranToday()) {
      throw new BadRequestException('تاریخ وزن‌کشی نمی‌تواند در آینده باشد');
    }
    const weight = await this.weightsRepository.save(
      this.weightsRepository.create({
        petId,
        weightKg: dto.weightKg,
        measuredAt,
        note: dto.note ?? null,
      }),
    );
    await this.syncCurrentWeight(petId);
    return weight;
  }

  async removeWeight(ownerId: string, petId: string, weightId: string) {
    await this.getPet(ownerId, petId);
    const result = await this.weightsRepository.delete({ id: weightId, petId });
    if (!result.affected) throw new NotFoundException('وزن ثبت‌شده یافت نشد');
    await this.syncCurrentWeight(petId);
  }

  /** The pet's profile weight follows its most recent measurement. */
  private async syncCurrentWeight(petId: string): Promise<void> {
    const latest = await this.weightsRepository.findOne({
      where: { petId },
      order: { measuredAt: 'DESC', createdAt: 'DESC' },
    });
    if (latest)
      await this.petsRepository.update(petId, { weight: latest.weightKg });
  }

  // ---- events ----

  async listEvents(ownerId: string, petId: string) {
    await this.getPet(ownerId, petId);
    return this.eventsRepository.find({
      where: { petId },
      order: { eventAt: 'DESC' },
    });
  }

  async addEvent(ownerId: string, petId: string, dto: CreateEventDto) {
    await this.getPet(ownerId, petId);
    return this.eventsRepository.save(
      this.eventsRepository.create({
        petId,
        type: dto.type,
        title: dto.title,
        note: dto.note ?? null,
        eventAt: dto.eventAt ? new Date(dto.eventAt) : new Date(),
      }),
    );
  }

  async updateEvent(
    ownerId: string,
    petId: string,
    id: string,
    dto: UpdateEventDto,
  ) {
    await this.getPet(ownerId, petId);
    const event = await this.getOrThrow(
      this.eventsRepository,
      { id, petId },
      'رویداد یافت نشد',
    );
    const { eventAt, ...rest } = dto;
    Object.assign(event, rest);
    if (eventAt) event.eventAt = new Date(eventAt);
    return this.eventsRepository.save(event);
  }

  async removeEvent(ownerId: string, petId: string, id: string) {
    await this.getPet(ownerId, petId);
    await this.deleteOrThrow(
      this.eventsRepository,
      { id, petId },
      'رویداد یافت نشد',
    );
  }

  // ---- medications ----

  async listMedications(ownerId: string, petId: string, activeOnly?: boolean) {
    await this.getPet(ownerId, petId);
    return this.medicationsRepository.find({
      where: { petId, ...(activeOnly ? { isActive: true } : {}) },
      order: { startDate: 'DESC' },
    });
  }

  async addMedication(
    ownerId: string,
    petId: string,
    dto: CreateMedicationDto,
  ) {
    await this.getPet(ownerId, petId);
    this.assertDateOrder(dto.startDate, dto.endDate);
    return this.medicationsRepository.save(
      this.medicationsRepository.create({
        petId,
        name: dto.name,
        dosage: dto.dosage ?? null,
        frequency: dto.frequency ?? null,
        startDate: dto.startDate.slice(0, 10),
        endDate: dto.endDate?.slice(0, 10) ?? null,
        notes: dto.notes ?? null,
        isActive: dto.isActive ?? true,
      }),
    );
  }

  async updateMedication(
    ownerId: string,
    petId: string,
    id: string,
    dto: UpdateMedicationDto,
  ) {
    await this.getPet(ownerId, petId);
    const medication = await this.getOrThrow(
      this.medicationsRepository,
      { id, petId },
      'دارو یافت نشد',
    );
    const { startDate, endDate, ...rest } = dto;
    Object.assign(medication, rest);
    if (startDate) medication.startDate = startDate.slice(0, 10);
    if (endDate) medication.endDate = endDate.slice(0, 10);
    this.assertDateOrder(medication.startDate, medication.endDate ?? undefined);
    return this.medicationsRepository.save(medication);
  }

  async removeMedication(ownerId: string, petId: string, id: string) {
    await this.getPet(ownerId, petId);
    await this.deleteOrThrow(
      this.medicationsRepository,
      { id, petId },
      'دارو یافت نشد',
    );
  }

  // ---- surgeries ----

  async listSurgeries(ownerId: string, petId: string) {
    await this.getPet(ownerId, petId);
    return this.surgeriesRepository.find({
      where: { petId },
      order: { surgeryDate: 'DESC' },
    });
  }

  async addSurgery(ownerId: string, petId: string, dto: CreateSurgeryDto) {
    await this.getPet(ownerId, petId);
    return this.surgeriesRepository.save(
      this.surgeriesRepository.create({
        petId,
        name: dto.name,
        surgeryDate: dto.surgeryDate.slice(0, 10),
        vetName: dto.vetName ?? null,
        clinicName: dto.clinicName ?? null,
        notes: dto.notes ?? null,
        status:
          dto.status ??
          (dto.surgeryDate.slice(0, 10) > tehranToday()
            ? SurgeryStatus.SCHEDULED
            : SurgeryStatus.DONE),
      }),
    );
  }

  async updateSurgery(
    ownerId: string,
    petId: string,
    id: string,
    dto: UpdateSurgeryDto,
  ) {
    await this.getPet(ownerId, petId);
    const surgery = await this.getOrThrow(
      this.surgeriesRepository,
      { id, petId },
      'جراحی یافت نشد',
    );
    const { surgeryDate, ...rest } = dto;
    Object.assign(surgery, rest);
    if (surgeryDate) surgery.surgeryDate = surgeryDate.slice(0, 10);
    return this.surgeriesRepository.save(surgery);
  }

  async cancelSurgery(ownerId: string, petId: string, id: string) {
    await this.getPet(ownerId, petId);
    const surgery = await this.getOrThrow(
      this.surgeriesRepository,
      { id, petId },
      'جراحی یافت نشد',
    );
    if (surgery.status !== SurgeryStatus.SCHEDULED) {
      throw new BadRequestException(
        'فقط جراحی‌های برنامه‌ریزی‌شده قابل لغو هستند',
      );
    }
    surgery.status = SurgeryStatus.CANCELLED;
    return this.surgeriesRepository.save(surgery);
  }

  async removeSurgery(ownerId: string, petId: string, id: string) {
    await this.getPet(ownerId, petId);
    await this.deleteOrThrow(
      this.surgeriesRepository,
      { id, petId },
      'جراحی یافت نشد',
    );
  }

  // ---- vaccines & documents ----

  async listVaccines(ownerId: string, petId: string) {
    await this.getPet(ownerId, petId);
    const today = tehranToday();
    const vaccines = await this.vaccinesRepository.find({
      where: { petId },
      order: { vaccineDate: 'DESC' },
    });
    return vaccines.map((v) => ({
      ...v,
      isOverdue: v.nextDueDate !== null && v.nextDueDate < today,
    }));
  }

  async updateVaccine(
    ownerId: string,
    petId: string,
    id: string,
    dto: UpdateVaccineDto,
  ) {
    await this.getPet(ownerId, petId);
    const vaccine = await this.getOrThrow(
      this.vaccinesRepository,
      { id, petId },
      'واکسن یافت نشد',
    );
    if (dto.vaccineDate && dto.vaccineDate.slice(0, 10) > tehranToday()) {
      throw new BadRequestException(
        'تاریخ تزریق واکسن نمی‌تواند در آینده باشد',
      );
    }
    if (dto.vaccineName !== undefined) vaccine.vaccineName = dto.vaccineName;
    if (dto.vaccineDate) vaccine.vaccineDate = dto.vaccineDate.slice(0, 10);
    if (dto.nextDueDate) vaccine.nextDueDate = dto.nextDueDate.slice(0, 10);
    if (dto.notes !== undefined) vaccine.notes = dto.notes;
    return this.vaccinesRepository.save(vaccine);
  }

  async removeVaccine(ownerId: string, petId: string, id: string) {
    await this.getPet(ownerId, petId);
    await this.deleteOrThrow(
      this.vaccinesRepository,
      { id, petId },
      'واکسن یافت نشد',
    );
  }

  async removeDocument(ownerId: string, petId: string, id: string) {
    await this.getPet(ownerId, petId);
    const document = await this.getOrThrow(
      this.documentsRepository,
      { id, petId },
      'فایل یافت نشد',
    );
    await this.documentsRepository.remove(document);
    await removeUploadUrls([document.fileUrl]);
  }

  // ---- timeline ----

  /**
   * One feed of everything that happened to the pet, newest first. Page with
   * `before` set to the previous response's `nextBefore`.
   */
  async timeline(ownerId: string, petId: string, query: TimelineQueryDto) {
    await this.getPet(ownerId, petId);
    const wanted = query.kinds
      ? ALL_KINDS.filter((kind) => query.kinds!.split(',').includes(kind))
      : ALL_KINDS;
    const before = query.before
      ? new Date(query.before)
      : new Date(Date.now() + 366 * 86_400_000);
    const take = query.limit + 1;
    const beforeDate = before.toLocaleDateString('en-CA', {
      timeZone: 'Asia/Tehran',
    });
    const items: TimelineItem[] = [];

    if (wanted.includes('reservation')) {
      const rows = await this.reservationsRepository.find({
        where: { petId, ownerId, scheduledAt: LessThan(before) },
        relations: { vet: true },
        order: { scheduledAt: 'DESC' },
        take,
      });
      items.push(
        ...rows.map((r) => ({
          kind: 'reservation' as const,
          id: r.id,
          at: r.scheduledAt,
          title: r.serviceName,
          subtitle: r.vet?.fullName ?? null,
          data: { status: r.status, price: r.price, code: `BK-${r.number}` },
        })),
      );
    }
    if (wanted.includes('vaccine')) {
      const rows = await this.vaccinesRepository
        .createQueryBuilder('v')
        .where('v.petId = :petId AND v.vaccineDate <= :d', {
          petId,
          d: beforeDate,
        })
        .orderBy('v.vaccineDate', 'DESC')
        .take(take)
        .getMany();
      items.push(
        ...rows.map((v) => ({
          kind: 'vaccine' as const,
          id: v.id,
          at: atDate(v.vaccineDate),
          title: v.vaccineName,
          subtitle: v.nextDueDate ? `نوبت بعدی: ${v.nextDueDate}` : null,
          data: { nextDueDate: v.nextDueDate },
        })),
      );
    }
    if (wanted.includes('event')) {
      const rows = await this.eventsRepository.find({
        where: { petId, eventAt: LessThan(before) },
        order: { eventAt: 'DESC' },
        take,
      });
      items.push(
        ...rows.map((e) => ({
          kind: 'event' as const,
          id: e.id,
          at: e.eventAt,
          title: e.title,
          subtitle: e.note,
          data: { type: e.type },
        })),
      );
    }
    if (wanted.includes('weight')) {
      const rows = await this.weightsRepository
        .createQueryBuilder('w')
        .where('w.petId = :petId AND w.measuredAt <= :d', {
          petId,
          d: beforeDate,
        })
        .orderBy('w.measuredAt', 'DESC')
        .take(take)
        .getMany();
      items.push(
        ...rows.map((w) => ({
          kind: 'weight' as const,
          id: w.id,
          at: atDate(w.measuredAt),
          title: `وزن ${w.weightKg} کیلوگرم`,
          subtitle: w.note,
          data: { weightKg: w.weightKg },
        })),
      );
    }
    if (wanted.includes('surgery')) {
      const rows = await this.surgeriesRepository
        .createQueryBuilder('s')
        .where('s.petId = :petId AND s.surgeryDate <= :d', {
          petId,
          d: beforeDate,
        })
        .orderBy('s.surgeryDate', 'DESC')
        .take(take)
        .getMany();
      items.push(
        ...rows.map((s) => ({
          kind: 'surgery' as const,
          id: s.id,
          at: atDate(s.surgeryDate),
          title: s.name,
          subtitle: s.clinicName ?? s.vetName,
          data: { status: s.status },
        })),
      );
    }
    if (wanted.includes('medication')) {
      const rows = await this.medicationsRepository
        .createQueryBuilder('m')
        .where('m.petId = :petId AND m.startDate <= :d', {
          petId,
          d: beforeDate,
        })
        .orderBy('m.startDate', 'DESC')
        .take(take)
        .getMany();
      items.push(
        ...rows.map((m) => ({
          kind: 'medication' as const,
          id: m.id,
          at: atDate(m.startDate),
          title: m.name,
          subtitle: [m.dosage, m.frequency].filter(Boolean).join(' - ') || null,
          data: { endDate: m.endDate, isActive: m.isActive },
        })),
      );
    }
    if (wanted.includes('document')) {
      const rows = await this.documentsRepository.find({
        where: { petId, createdAt: LessThan(before) },
        order: { createdAt: 'DESC' },
        take,
      });
      items.push(
        ...rows.map((d) => ({
          kind: 'document' as const,
          id: d.id,
          at: d.createdAt,
          title: decodeMultipartFilename(d.originalName),
          subtitle: null,
          data: { mimeType: d.mimeType },
        })),
      );
    }

    // Dates are anchored at midnight, so an item exactly on the cursor is
    // dropped rather than repeated on the next page.
    const sorted = items
      .filter((item) => item.at.getTime() < before.getTime())
      .sort((a, b) => b.at.getTime() - a.at.getTime());
    const page = sorted.slice(0, query.limit);
    return {
      items: page,
      nextBefore:
        sorted.length > query.limit
          ? page[page.length - 1].at.toISOString()
          : null,
    };
  }

  // ---- helpers ----

  private async getPet(ownerId: string, petId: string): Promise<Pet> {
    const pet = await this.petsRepository.findOne({
      where: { id: petId, ownerId },
    });
    if (!pet) throw new NotFoundException('حیوان خانگی یافت نشد');
    return pet;
  }

  private async getOrThrow<T extends object>(
    repo: Repository<T>,
    where: Record<string, string>,
    message: string,
  ): Promise<T> {
    const entity = await repo.findOne({ where: where as never });
    if (!entity) throw new NotFoundException(message);
    return entity;
  }

  private async deleteOrThrow<T extends object>(
    repo: Repository<T>,
    where: Record<string, string>,
    message: string,
  ): Promise<void> {
    const result = await repo.delete(where as never);
    if (!result.affected) throw new NotFoundException(message);
  }

  private assertDateOrder(start: string, end?: string) {
    if (end && end.slice(0, 10) < start.slice(0, 10)) {
      throw new BadRequestException(
        'تاریخ پایان نمی‌تواند قبل از تاریخ شروع باشد',
      );
    }
  }
}
