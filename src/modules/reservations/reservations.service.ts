import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Paginated, paginated } from '../../common/dto/pagination-query.dto';
import {
  PaymentStatus,
  ReservationStatus,
} from '../../common/enums/admin-panel.enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Pet } from '../pets/entities/pet.entity';
import { User } from '../users/entities/user.entity';
import {
  CreateReservationDto,
  QueryReservationsDto,
  RescheduleReservationDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { ReservationEvent } from './entities/reservation-event.entity';
import { ReservationNote } from './entities/reservation-note.entity';
import { Reservation } from './entities/reservation.entity';

const ACTIVE_STATUSES = [
  ReservationStatus.PENDING,
  ReservationStatus.CONFIRMED,
];

const STATUS_LABELS: Record<ReservationStatus, string> = {
  [ReservationStatus.PENDING]: 'در انتظار تایید',
  [ReservationStatus.CONFIRMED]: 'تایید شده',
  [ReservationStatus.COMPLETED]: 'انجام شده',
  [ReservationStatus.CANCELLED]: 'لغو شده',
  [ReservationStatus.NO_SHOW]: 'عدم مراجعه',
};

export const reservationCode = (number: number) => `BK-${number}`;

interface PersonView {
  id: string;
  fullName: string | null;
  phoneNumber: string;
  email?: string | null;
}

export interface ReservationListItem {
  id: string;
  code: string;
  status: ReservationStatus;
  serviceName: string;
  scheduledAt: Date;
  durationMinutes: number;
  price: number;
  owner: PersonView;
  pet: { id: string; name: string | null } | null;
  vet: { id: string; fullName: string | null } | null;
  clinic: { id: string; name: string | null } | null;
  createdAt: Date;
}

@Injectable()
export class ReservationsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(ReservationNote)
    private readonly notesRepository: Repository<ReservationNote>,
    @InjectRepository(ReservationEvent)
    private readonly eventsRepository: Repository<ReservationEvent>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(
    query: QueryReservationsDto,
  ): Promise<Paginated<ReservationListItem>> {
    const qb = this.baseQuery();

    if (query.search) {
      qb.andWhere(
        `(CAST(r.number AS text) = :code OR r.serviceName ILIKE :s OR owner.fullName ILIKE :s OR owner.phoneNumber ILIKE :s OR pet.name ILIKE :s OR vet.fullName ILIKE :s)`,
        { code: query.search.replace(/^BK-/i, ''), s: `%${query.search}%` },
      );
    }
    for (const key of [
      'status',
      'ownerId',
      'petId',
      'vetId',
      'clinicId',
    ] as const) {
      if (query[key]) qb.andWhere(`r.${key} = :${key}`, { [key]: query[key] });
    }
    if (query.from) qb.andWhere('r.scheduledAt >= :from', { from: query.from });
    if (query.to)
      qb.andWhere('r.scheduledAt < :to::date + 1', { to: query.to });

    const [reservations, total] = await qb
      .orderBy('r.scheduledAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    const clinics = await this.loadClinics(reservations);
    return paginated(
      reservations.map((r) => this.toListItem(r, clinics)),
      total,
      query,
    );
  }

  async getStats() {
    const rows = await this.reservationsRepository
      .createQueryBuilder('r')
      .select('r.status', 'status')
      .addSelect('COUNT(*)', 'count')
      .groupBy('r.status')
      .getRawMany<{ status: ReservationStatus; count: string }>();
    const byStatus = Object.fromEntries(
      Object.values(ReservationStatus).map((status) => [status, 0]),
    ) as Record<ReservationStatus, number>;
    let total = 0;
    for (const row of rows) {
      byStatus[row.status] = Number(row.count);
      total += Number(row.count);
    }
    const today = await this.reservationsRepository
      .createQueryBuilder('r')
      .where(
        'r.scheduledAt >= CURRENT_DATE AND r.scheduledAt < CURRENT_DATE + 1',
      )
      .andWhere('r.status IN (:...active)', { active: ACTIVE_STATUSES })
      .getCount();
    return { total, today, byStatus };
  }

  async findOne(id: string) {
    const reservation = await this.baseQuery()
      .andWhere('r.id = :id', { id })
      .getOne();
    if (!reservation) throw new NotFoundException('رزرو یافت نشد');

    const clinics = await this.loadClinics([reservation]);
    const [payments, notes, timeline] = await Promise.all([
      this.dataSource.getRepository(Payment).find({
        where: { reservationId: id },
        order: { createdAt: 'DESC' },
      }),
      this.notesRepository.find({
        where: { reservationId: id },
        relations: { author: true },
        order: { createdAt: 'DESC' },
      }),
      this.eventsRepository.find({
        where: { reservationId: id },
        order: { createdAt: 'ASC' },
      }),
    ]);

    const clinicProfile = reservation.clinicId
      ? clinics.get(reservation.clinicId)
      : undefined;
    return {
      ...this.toListItem(reservation, clinics),
      statusLabel: STATUS_LABELS[reservation.status],
      serviceDescription: reservation.serviceDescription,
      clinicNote: reservation.clinicNote,
      cancelReason: reservation.cancelReason,
      cancelledAt: reservation.cancelledAt,
      owner: {
        ...this.toListItem(reservation, clinics).owner,
        email: reservation.owner.email,
      },
      pet: reservation.pet
        ? {
            id: reservation.pet.id,
            name: reservation.pet.name,
            type: reservation.pet.type,
            breed: reservation.pet.breed,
            gender: reservation.pet.gender,
          }
        : null,
      clinicDetails: clinicProfile
        ? {
            id: reservation.clinicId,
            name: clinicProfile.name,
            phone: clinicProfile.phone,
            address: clinicProfile.address,
          }
        : null,
      payment: this.summarizePayments(payments),
      payments: payments.map((p) => ({
        id: p.id,
        code: `TX-${p.number}`,
        status: p.status,
        method: p.method,
        gateway: p.gateway,
        finalAmount: p.finalAmount,
        refundedAmount: p.refundedAmount,
        paidAt: p.paidAt,
      })),
      notes: notes.map((n) => ({
        id: n.id,
        text: n.text,
        author: n.author
          ? { id: n.author.id, fullName: n.author.fullName }
          : null,
        createdAt: n.createdAt,
      })),
      timeline: timeline.map((e) => ({
        id: e.id,
        type: e.type,
        message: e.message,
        createdAt: e.createdAt,
      })),
      updatedAt: reservation.updatedAt,
    };
  }

  async create(dto: CreateReservationDto, actorId: string) {
    await this.assertParties(dto);
    const scheduledAt = new Date(dto.scheduledAt);
    const durationMinutes = dto.durationMinutes ?? 30;
    const status = dto.status ?? ReservationStatus.PENDING;
    if (ACTIVE_STATUSES.includes(status)) {
      await this.assertNoConflict(dto.vetId, scheduledAt, durationMinutes);
    }

    const reservation = await this.reservationsRepository.save(
      this.reservationsRepository.create({
        ...dto,
        scheduledAt,
        durationMinutes,
        status,
      }),
    );
    await this.addEvent(
      reservation.id,
      'created',
      'رزرو توسط ادمین ثبت شد',
      actorId,
    );
    return this.findOne(reservation.id);
  }

  async update(id: string, dto: UpdateReservationDto, actorId: string) {
    const reservation = await this.getOrThrow(id);
    const merged = {
      ownerId: dto.ownerId ?? reservation.ownerId,
      petId: dto.petId === undefined ? reservation.petId : dto.petId,
      vetId: dto.vetId === undefined ? reservation.vetId : dto.vetId,
      clinicId:
        dto.clinicId === undefined ? reservation.clinicId : dto.clinicId,
    };
    await this.assertParties(merged);

    const { scheduledAt: scheduledRaw, status, ...rest } = dto;
    const scheduledAt = scheduledRaw
      ? new Date(scheduledRaw)
      : reservation.scheduledAt;
    const durationMinutes = dto.durationMinutes ?? reservation.durationMinutes;
    const nextStatus = status ?? reservation.status;
    if (ACTIVE_STATUSES.includes(nextStatus)) {
      await this.assertNoConflict(
        merged.vetId,
        scheduledAt,
        durationMinutes,
        id,
      );
    }

    Object.assign(reservation, rest, { scheduledAt, durationMinutes });
    if (status && status !== reservation.status) {
      this.assertStatusChange(status);
      reservation.status = status;
      await this.addEvent(
        id,
        'status',
        `وضعیت رزرو به «${STATUS_LABELS[status]}» تغییر کرد`,
        actorId,
      );
    }
    await this.reservationsRepository.save(reservation);
    await this.addEvent(id, 'edited', 'اطلاعات رزرو ویرایش شد', actorId);
    return this.findOne(id);
  }

  async reschedule(id: string, dto: RescheduleReservationDto, actorId: string) {
    const reservation = await this.getOrThrow(id);
    if (!ACTIVE_STATUSES.includes(reservation.status)) {
      throw new BadRequestException('فقط رزروهای فعال قابل جابجایی هستند');
    }
    const scheduledAt = new Date(dto.scheduledAt);
    const durationMinutes = dto.durationMinutes ?? reservation.durationMinutes;
    await this.assertNoConflict(
      reservation.vetId,
      scheduledAt,
      durationMinutes,
      id,
    );

    await this.reservationsRepository.update(id, {
      scheduledAt,
      durationMinutes,
    });
    await this.addEvent(id, 'rescheduled', 'زمان رزرو تغییر کرد', actorId);
    return this.findOne(id);
  }

  async changeStatus(id: string, status: ReservationStatus, actorId: string) {
    const reservation = await this.getOrThrow(id);
    this.assertStatusChange(status);
    if (status !== reservation.status) {
      if (
        ACTIVE_STATUSES.includes(status) &&
        !ACTIVE_STATUSES.includes(reservation.status)
      ) {
        await this.assertNoConflict(
          reservation.vetId,
          reservation.scheduledAt,
          reservation.durationMinutes,
          id,
        );
      }
      await this.reservationsRepository.update(id, {
        status,
        cancelReason: null,
        cancelledAt: null,
      });
      await this.addEvent(
        id,
        'status',
        `وضعیت رزرو به «${STATUS_LABELS[status]}» تغییر کرد`,
        actorId,
      );
    }
    return this.findOne(id);
  }

  async cancel(id: string, reason: string, actorId: string) {
    const reservation = await this.getOrThrow(id);
    if (!ACTIVE_STATUSES.includes(reservation.status)) {
      throw new BadRequestException('فقط رزروهای فعال قابل لغو هستند');
    }
    await this.reservationsRepository.update(id, {
      status: ReservationStatus.CANCELLED,
      cancelReason: reason,
      cancelledAt: new Date(),
    });
    await this.addEvent(id, 'cancelled', `رزرو لغو شد: ${reason}`, actorId);
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    await this.reservationsRepository.remove(await this.getOrThrow(id));
  }

  async addNote(id: string, text: string, authorId: string) {
    await this.getOrThrow(id);
    await this.notesRepository.save(
      this.notesRepository.create({ reservationId: id, text, authorId }),
    );
    return (await this.findOne(id)).notes;
  }

  async removeNote(id: string, noteId: string): Promise<void> {
    const note = await this.notesRepository.findOne({
      where: { id: noteId, reservationId: id },
    });
    if (!note) throw new NotFoundException('یادداشت یافت نشد');
    await this.notesRepository.remove(note);
  }

  // ---- helpers ----

  private baseQuery() {
    return this.reservationsRepository
      .createQueryBuilder('r')
      .innerJoinAndSelect('r.owner', 'owner')
      .leftJoinAndSelect('r.pet', 'pet')
      .leftJoinAndSelect('r.vet', 'vet');
  }

  private async getOrThrow(id: string): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id },
    });
    if (!reservation) throw new NotFoundException('رزرو یافت نشد');
    return reservation;
  }

  private assertStatusChange(status: ReservationStatus) {
    if (status === ReservationStatus.CANCELLED) {
      throw new BadRequestException('برای لغو رزرو از عملیات لغو استفاده کنید');
    }
  }

  private async assertParties(parties: {
    ownerId?: string;
    petId?: string | null;
    vetId?: string | null;
    clinicId?: string | null;
  }): Promise<void> {
    const ids = [parties.ownerId, parties.vetId, parties.clinicId].filter(
      (value): value is string => !!value,
    );
    const users = await this.usersRepository.find({ where: { id: In(ids) } });
    const byId = new Map(users.map((user) => [user.id, user]));

    if (!parties.ownerId || !byId.has(parties.ownerId)) {
      throw new NotFoundException('صاحب پت یافت نشد');
    }
    if (parties.vetId && byId.get(parties.vetId)?.role !== UserRole.VET) {
      throw new BadRequestException('دامپزشک انتخاب‌شده معتبر نیست');
    }
    if (
      parties.clinicId &&
      byId.get(parties.clinicId)?.role !== UserRole.CLINIC
    ) {
      throw new BadRequestException('کلینیک انتخاب‌شده معتبر نیست');
    }
    if (parties.petId) {
      const pet = await this.petsRepository.findOne({
        where: { id: parties.petId },
      });
      if (!pet || pet.ownerId !== parties.ownerId) {
        throw new BadRequestException('این پت متعلق به صاحب انتخاب‌شده نیست');
      }
    }
  }

  /** A vet can only be in one active appointment at a time. */
  private async assertNoConflict(
    vetId: string | null | undefined,
    start: Date,
    durationMinutes: number,
    exceptId?: string,
  ): Promise<void> {
    if (!vetId) return;
    const end = new Date(start.getTime() + durationMinutes * 60_000);
    const qb = this.reservationsRepository
      .createQueryBuilder('r')
      .where('r.vetId = :vetId', { vetId })
      .andWhere('r.status IN (:...active)', { active: ACTIVE_STATUSES })
      .andWhere('r.scheduledAt < :end', { end })
      .andWhere(
        `r.scheduledAt + (r.durationMinutes * interval '1 minute') > :start`,
        { start },
      );
    if (exceptId) qb.andWhere('r.id != :exceptId', { exceptId });
    if ((await qb.getCount()) > 0) {
      throw new ConflictException(
        'این دامپزشک در این بازه زمانی رزرو دیگری دارد',
      );
    }
  }

  private async addEvent(
    reservationId: string,
    type: string,
    message: string,
    actorId: string,
  ): Promise<void> {
    await this.eventsRepository.insert({
      reservationId,
      type,
      message,
      actorId,
    });
  }

  private async loadClinics(reservations: Reservation[]) {
    const ids = [
      ...new Set(
        reservations.map((r) => r.clinicId).filter((id): id is string => !!id),
      ),
    ];
    if (ids.length === 0) return new Map<string, Clinic>();
    const clinics = await this.clinicsRepository.find({
      where: { userId: In(ids) },
    });
    return new Map(clinics.map((clinic) => [clinic.userId, clinic]));
  }

  private summarizePayments(payments: Payment[]) {
    const paid = payments.filter(
      (p) =>
        p.status === PaymentStatus.SUCCESS ||
        p.status === PaymentStatus.REFUNDED,
    );
    const paidAmount = paid.reduce(
      (sum, p) => sum + p.finalAmount - p.refundedAmount,
      0,
    );
    let status: 'unpaid' | 'pending' | 'paid' | 'refunded' = 'unpaid';
    if (paid.some((p) => p.status === PaymentStatus.SUCCESS)) status = 'paid';
    else if (paid.length > 0) status = 'refunded';
    else if (payments.some((p) => p.status === PaymentStatus.PENDING))
      status = 'pending';
    return { status, paidAmount };
  }

  private toListItem(
    r: Reservation,
    clinics: Map<string, Clinic>,
  ): ReservationListItem {
    return {
      id: r.id,
      code: reservationCode(r.number),
      status: r.status,
      serviceName: r.serviceName,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      price: r.price,
      owner: {
        id: r.owner.id,
        fullName: r.owner.fullName,
        phoneNumber: r.owner.phoneNumber,
      },
      pet: r.pet ? { id: r.pet.id, name: r.pet.name } : null,
      vet: r.vet ? { id: r.vet.id, fullName: r.vet.fullName } : null,
      clinic: r.clinicId
        ? { id: r.clinicId, name: clinics.get(r.clinicId)?.name ?? null }
        : null,
      createdAt: r.createdAt,
    };
  }
}
