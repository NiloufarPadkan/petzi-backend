import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import {
  Paginated,
  PaginationQueryDto,
  paginated,
} from '../../common/dto/pagination-query.dto';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { normalizePhoneNumber } from '../../common/validators/is-iranian-phone.validator';
import { Pet } from '../pets/entities/pet.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  User,
} from '../users/entities/user.entity';
import { MAX_RECORD_IMAGES } from './clinic-panel.constants';
import type { ClinicContext } from './clinic-panel.guard';
import {
  AddPatientDto,
  CreateRecordDto,
  QueryPatientsDto,
  UpdatePatientDto,
  UpdateRecordDto,
} from './dto/patients.dto';
import { ClinicMember } from './entities/clinic-member.entity';
import { ClinicPatient } from './entities/clinic-patient.entity';
import { PatientRecord } from './entities/patient-record.entity';

const VISIT_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
  ReservationStatus.COMPLETED,
];

@Injectable()
export class ClinicPatientsService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(ClinicPatient)
    private readonly patientsRepository: Repository<ClinicPatient>,
    @InjectRepository(PatientRecord)
    private readonly recordsRepository: Repository<PatientRecord>,
    @InjectRepository(ClinicMember)
    private readonly membersRepository: Repository<ClinicMember>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async list(ctx: ClinicContext, query: QueryPatientsDto) {
    const { clinicId } = ctx;
    const qb = this.patientsQuery(clinicId);

    if (query.search) {
      qb.andWhere(
        '(pet.name ILIKE :s OR owner.fullName ILIKE :s OR owner.phoneNumber ILIKE :s OR pet.microchipNumber ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    if (query.type) qb.andWhere('pet.type = :type', { type: query.type });
    if (query.vetId) qb.andWhere('cp.vetId = :vetId', { vetId: query.vetId });

    const [pets, total] = await qb
      .orderBy('pet.name', 'ASC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    const visits = await this.visitStats(
      clinicId,
      pets.map((pet) => pet.id),
    );
    return paginated(
      pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        photoUrl: pet.photoUrl,
        type: pet.type,
        breed: pet.breed,
        gender: pet.gender,
        owner: this.ownerView(pet.owner),
        vaccinationStatus: pet.vaccinationStatus,
        visitCount: visits.get(pet.id)?.count ?? 0,
        lastVisitAt: visits.get(pet.id)?.last ?? null,
      })),
      total,
      query,
    );
  }

  async findOne(ctx: ClinicContext, petId: string) {
    const { pet, record } = await this.getPatientOrThrow(ctx.clinicId, petId);
    const [reservations, recordCount, vet] = await Promise.all([
      this.dataSource.getRepository(Reservation).find({
        where: { clinicId: ctx.clinicId, petId },
        relations: { vet: true },
        order: { scheduledAt: 'DESC' },
        take: 20,
      }),
      this.recordsRepository.count({
        where: { clinicId: ctx.clinicId, petId },
      }),
      this.resolveVet(ctx.clinicId, petId, record?.vetId ?? null),
    ]);
    const visits = (await this.visitStats(ctx.clinicId, [petId])).get(petId);

    return {
      id: pet.id,
      name: pet.name,
      photoUrl: pet.photoUrl,
      type: pet.type,
      breed: pet.breed,
      gender: pet.gender,
      color: pet.color,
      birthDate: pet.birthDate,
      weight: pet.weight,
      microchipNumber: pet.microchipNumber,
      underlyingDiseases: pet.underlyingDiseases,
      allergies: pet.allergies,
      medications: pet.medications,
      healthNotes: pet.healthNotes,
      vaccinationStatus: pet.vaccinationStatus,
      owner: this.ownerView(pet.owner),
      vet,
      medicalNotes: record?.medicalNotes ?? null,
      firstVisitAt: visits?.first ?? record?.firstVisitAt ?? null,
      lastVisitAt: visits?.last ?? null,
      visitCount: visits?.count ?? 0,
      recordCount,
      reservations: reservations.map((r) => ({
        id: r.id,
        code: `BK-${r.number}`,
        serviceName: r.serviceName,
        status: r.status,
        scheduledAt: r.scheduledAt,
        price: r.price,
        vet: r.vet ? { id: r.vet.id, fullName: r.vet.fullName } : null,
      })),
    };
  }

  async add(ctx: ClinicContext, dto: AddPatientDto) {
    await this.assertClinicVet(ctx.clinicId, dto.vetId);

    let petId: string;
    if (dto.petId) {
      const pet = await this.petsRepository.findOne({
        where: { id: dto.petId, status: PetStatus.ACTIVE },
      });
      if (!pet) throw new NotFoundException('پت یافت نشد');
      petId = pet.id;
    } else {
      if (!dto.pet || !dto.owner) {
        throw new BadRequestException('اطلاعات پت و صاحب پت الزامی است');
      }
      petId = await this.createPetWithOwner(dto);
    }

    const existing = await this.patientsRepository.findOne({
      where: { clinicId: ctx.clinicId, petId },
    });
    if (existing) {
      await this.patientsRepository.update(existing.id, {
        archivedAt: null,
        ...(dto.vetId ? { vetId: dto.vetId } : {}),
        ...(dto.medicalNotes !== undefined
          ? { medicalNotes: dto.medicalNotes }
          : {}),
      });
    } else {
      await this.patientsRepository.save(
        this.patientsRepository.create({
          clinicId: ctx.clinicId,
          petId,
          vetId: dto.vetId ?? null,
          medicalNotes: dto.medicalNotes ?? null,
        }),
      );
    }
    return this.findOne(ctx, petId);
  }

  async update(ctx: ClinicContext, petId: string, dto: UpdatePatientDto) {
    const { record } = await this.getPatientOrThrow(ctx.clinicId, petId);
    if (dto.vetId) await this.assertClinicVet(ctx.clinicId, dto.vetId);

    const petChanges: Partial<Pet> = {};
    for (const key of [
      'microchipNumber',
      'allergies',
      'underlyingDiseases',
      'medications',
      'weight',
    ] as const) {
      if (dto[key] !== undefined)
        Object.assign(petChanges, { [key]: dto[key] });
    }
    if (Object.keys(petChanges).length > 0) {
      await this.petsRepository.update(petId, petChanges);
    }

    const clinicChanges: Partial<ClinicPatient> = {};
    if (dto.vetId !== undefined) clinicChanges.vetId = dto.vetId;
    if (dto.medicalNotes !== undefined)
      clinicChanges.medicalNotes = dto.medicalNotes;
    if (Object.keys(clinicChanges).length > 0) {
      if (record) {
        await this.patientsRepository.update(record.id, clinicChanges);
      } else {
        // The pet is a patient through its reservations; give it a row.
        await this.patientsRepository.save(
          this.patientsRepository.create({
            clinicId: ctx.clinicId,
            petId,
            ...clinicChanges,
          }),
        );
      }
    }
    return this.findOne(ctx, petId);
  }

  /** Hides the patient from the list; reservations and records are kept. */
  async archive(ctx: ClinicContext, petId: string): Promise<void> {
    const { record } = await this.getPatientOrThrow(ctx.clinicId, petId);
    if (record) {
      await this.patientsRepository.update(record.id, {
        archivedAt: new Date(),
      });
    } else {
      await this.patientsRepository.save(
        this.patientsRepository.create({
          clinicId: ctx.clinicId,
          petId,
          archivedAt: new Date(),
        }),
      );
    }
  }

  // ---- medical records ----

  async listRecords(
    ctx: ClinicContext,
    petId: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<ReturnType<ClinicPatientsService['toRecordView']>>> {
    await this.getPatientOrThrow(ctx.clinicId, petId);
    const [records, total] = await this.recordsRepository.findAndCount({
      where: { clinicId: ctx.clinicId, petId },
      relations: { vet: true },
      order: { recordedAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginated(
      records.map((record) => this.toRecordView(record)),
      total,
      query,
    );
  }

  async getRecord(ctx: ClinicContext, petId: string, recordId: string) {
    return this.toRecordView(
      await this.getRecordOrThrow(ctx.clinicId, petId, recordId),
    );
  }

  async createRecord(ctx: ClinicContext, petId: string, dto: CreateRecordDto) {
    await this.getPatientOrThrow(ctx.clinicId, petId);
    const vetId = dto.vetId ?? (await this.actorVetId(ctx));
    await this.assertClinicVet(ctx.clinicId, vetId);

    const record = await this.recordsRepository.save(
      this.recordsRepository.create({
        clinicId: ctx.clinicId,
        petId,
        vetId,
        type: dto.type ?? 'visit',
        title: dto.title,
        recordedAt: new Date(dto.recordedAt),
        result: dto.result ?? null,
        aiSummary: dto.aiSummary ?? null,
        prescriptions: (dto.prescriptions ?? []).map((p) => ({
          name: p.name,
          dosage: p.dosage ?? null,
          instructions: p.instructions ?? null,
        })),
      }),
    );
    return this.getRecord(ctx, petId, record.id);
  }

  async updateRecord(
    ctx: ClinicContext,
    petId: string,
    recordId: string,
    dto: UpdateRecordDto,
  ) {
    const record = await this.getRecordOrThrow(ctx.clinicId, petId, recordId);
    if (dto.vetId) await this.assertClinicVet(ctx.clinicId, dto.vetId);

    const changes: Partial<PatientRecord> = {};
    if (dto.type !== undefined) changes.type = dto.type;
    if (dto.title !== undefined) changes.title = dto.title;
    if (dto.recordedAt !== undefined)
      changes.recordedAt = new Date(dto.recordedAt);
    if (dto.vetId !== undefined) changes.vetId = dto.vetId;
    if (dto.result !== undefined) changes.result = dto.result;
    if (dto.aiSummary !== undefined) changes.aiSummary = dto.aiSummary;
    if (dto.prescriptions !== undefined) {
      changes.prescriptions = dto.prescriptions.map((p) => ({
        name: p.name,
        dosage: p.dosage ?? null,
        instructions: p.instructions ?? null,
      }));
    }
    if (Object.keys(changes).length > 0) {
      await this.recordsRepository.update(record.id, changes);
    }
    return this.getRecord(ctx, petId, recordId);
  }

  async deleteRecord(ctx: ClinicContext, petId: string, recordId: string) {
    const record = await this.getRecordOrThrow(ctx.clinicId, petId, recordId);
    await this.recordsRepository.remove(record);
    if (record.images.length) await removeUploadUrls(record.images);
  }

  async addRecordImage(
    ctx: ClinicContext,
    petId: string,
    recordId: string,
    url: string,
  ) {
    const record = await this.getRecordOrThrow(ctx.clinicId, petId, recordId);
    if (record.images.length >= MAX_RECORD_IMAGES) {
      await removeUploadUrls([url]);
      throw new BadRequestException(
        `حداکثر ${MAX_RECORD_IMAGES} تصویر مجاز است`,
      );
    }
    await this.recordsRepository.update(record.id, {
      images: [...record.images, url],
    });
    return this.getRecord(ctx, petId, recordId);
  }

  async removeRecordImage(
    ctx: ClinicContext,
    petId: string,
    recordId: string,
    index: number,
  ) {
    const record = await this.getRecordOrThrow(ctx.clinicId, petId, recordId);
    const url = record.images[index];
    if (!url) throw new NotFoundException('تصویر یافت نشد');
    await this.recordsRepository.update(record.id, {
      images: record.images.filter((_, i) => i !== index),
    });
    await removeUploadUrls([url]);
    return this.getRecord(ctx, petId, recordId);
  }

  /** Ensures the pet belongs to the clinic before any record work. */
  async assertPatient(ctx: ClinicContext, petId: string): Promise<void> {
    await this.getPatientOrThrow(ctx.clinicId, petId);
  }

  // ---- helpers ----

  private patientsQuery(clinicId: string) {
    return this.petsRepository
      .createQueryBuilder('pet')
      .innerJoinAndSelect('pet.owner', 'owner')
      .leftJoin(
        ClinicPatient,
        'cp',
        'cp."petId" = pet.id AND cp."clinicId" = :clinicId',
        { clinicId },
      )
      .where('pet.status = :active', { active: PetStatus.ACTIVE })
      .andWhere('owner.deletedAt IS NULL')
      .andWhere('cp."archivedAt" IS NULL')
      .andWhere(
        `(cp.id IS NOT NULL OR EXISTS (SELECT 1 FROM reservations r WHERE r."petId" = pet.id AND r."clinicId" = :clinicId))`,
      );
  }

  private async getPatientOrThrow(clinicId: string, petId: string) {
    const pet = await this.patientsQuery(clinicId)
      .andWhere('pet.id = :petId', { petId })
      .getOne();
    if (!pet) throw new NotFoundException('بیمار یافت نشد');
    const record = await this.patientsRepository.findOne({
      where: { clinicId, petId },
    });
    return { pet, record };
  }

  private async getRecordOrThrow(
    clinicId: string,
    petId: string,
    recordId: string,
  ) {
    await this.getPatientOrThrow(clinicId, petId);
    const record = await this.recordsRepository.findOne({
      where: { id: recordId, clinicId, petId },
      relations: { vet: true },
    });
    if (!record) throw new NotFoundException('سابقه پزشکی یافت نشد');
    return record;
  }

  private async visitStats(clinicId: string, petIds: string[]) {
    const stats = new Map<string, { count: number; first: Date; last: Date }>();
    if (petIds.length === 0) return stats;
    const rows = await this.dataSource
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .select('r.petId', 'petId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MIN(r.scheduledAt)', 'first')
      .addSelect('MAX(r.scheduledAt)', 'last')
      .where('r.clinicId = :clinicId AND r.petId IN (:...petIds)', {
        clinicId,
        petIds,
      })
      .andWhere('r.status IN (:...statuses)', { statuses: VISIT_STATUSES })
      .groupBy('r.petId')
      .getRawMany<{ petId: string; count: string; first: Date; last: Date }>();
    for (const row of rows) {
      stats.set(row.petId, {
        count: Number(row.count),
        first: row.first,
        last: row.last,
      });
    }
    return stats;
  }

  private async resolveVet(
    clinicId: string,
    petId: string,
    vetId: string | null,
  ) {
    let id = vetId;
    if (!id) {
      const latest = await this.dataSource.getRepository(Reservation).findOne({
        where: { clinicId, petId },
        order: { scheduledAt: 'DESC' },
      });
      id = latest?.vetId ?? null;
    }
    if (!id) return null;
    const vet = await this.usersRepository.findOne({ where: { id } });
    return vet ? { id: vet.id, fullName: vet.fullName } : null;
  }

  private async createPetWithOwner(dto: AddPatientDto): Promise<string> {
    const { pet, owner } = dto;
    const phoneNumber = normalizePhoneNumber(owner!.phoneNumber);
    try {
      return await this.dataSource.transaction(async (manager) => {
        let ownerUser = await manager.findOne(User, { where: { phoneNumber } });
        if (!ownerUser) {
          ownerUser = await manager.save(
            manager.create(User, {
              role: UserRole.USER,
              phoneNumber,
              fullName: owner!.fullName,
              email: owner!.email?.toLowerCase(),
              notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
            }),
          );
        } else if (ownerUser.role !== UserRole.USER) {
          throw new BadRequestException(
            'این شماره متعلق به حساب غیر از صاحب پت است',
          );
        }
        const created = await manager.save(
          manager.create(Pet, {
            ownerId: ownerUser.id,
            status: PetStatus.ACTIVE,
            ...pet,
          }),
        );
        return created.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }
  }

  private async assertClinicVet(clinicId: string, vetId?: string | null) {
    if (!vetId) return;
    const isMember = await this.membersRepository.exists({
      where: { clinicId, userId: vetId, isActive: true },
    });
    if (!isMember)
      throw new BadRequestException('دامپزشک انتخاب‌شده عضو این کلینیک نیست');
  }

  /** The signed-in vet, when the actor is one of the clinic's vets. */
  private async actorVetId(ctx: ClinicContext): Promise<string | null> {
    if (ctx.isManager) return null;
    const isVet = await this.membersRepository.exists({
      where: { clinicId: ctx.clinicId, userId: ctx.userId, isActive: true },
    });
    return isVet ? ctx.userId : null;
  }

  private ownerView(owner: User) {
    return {
      id: owner.id,
      fullName: owner.fullName,
      phoneNumber: owner.phoneNumber,
    };
  }

  private toRecordView(record: PatientRecord) {
    return {
      id: record.id,
      type: record.type,
      title: record.title,
      recordedAt: record.recordedAt,
      vet: record.vet
        ? { id: record.vet.id, fullName: record.vet.fullName }
        : null,
      result: record.result,
      aiSummary: record.aiSummary,
      images: record.images,
      prescriptions: record.prescriptions,
      createdAt: record.createdAt,
    };
  }
}
