import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { Paginated, paginated } from '../../common/dto/pagination-query.dto';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { NotificationType } from '../../common/enums/owner-app.enums';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { ClinicReview } from '../clinics/entities/clinic-review.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { NotificationsService } from '../notifications/notifications.service';
import { Pet } from '../pets/entities/pet.entity';
import { AvailabilityService } from '../providers/availability.service';
import { ProvidersService } from '../providers/providers.service';
import { ReservationEvent } from '../reservations/entities/reservation-event.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { VetReview } from '../vets/entities/vet-review.entity';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import {
  CreateBookingDto,
  CreateReviewDto,
  QueryMyReservationsDto,
} from './dto/booking.dto';
import { ReservationPaymentsService } from './reservation-payments.service';

const ACTIVE = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];

const STATUS_LABELS: Record<ReservationStatus, string> = {
  [ReservationStatus.PENDING]: 'در انتظار تایید',
  [ReservationStatus.CONFIRMED]: 'تایید شده',
  [ReservationStatus.COMPLETED]: 'انجام شده',
  [ReservationStatus.CANCELLED]: 'لغو شده',
  [ReservationStatus.NO_SHOW]: 'عدم مراجعه',
};

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(ReservationEvent)
    private readonly eventsRepository: Repository<ReservationEvent>,
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(VetReview)
    private readonly vetReviewsRepository: Repository<VetReview>,
    @InjectRepository(ClinicReview)
    private readonly clinicReviewsRepository: Repository<ClinicReview>,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    private readonly dataSource: DataSource,
    private readonly providersService: ProvidersService,
    private readonly availabilityService: AvailabilityService,
    private readonly notificationsService: NotificationsService,
    private readonly reservationPayments: ReservationPaymentsService,
  ) {}

  /**
   * Books a free slot. The request starts as pending: the clinic or vet
   * confirms or declines it from their panel.
   */
  async create(ownerId: string, dto: CreateBookingDto) {
    const pet = await this.petsRepository.findOne({
      where: { id: dto.petId, ownerId },
    });
    if (!pet) throw new NotFoundException('حیوان خانگی یافت نشد');
    if (pet.status !== PetStatus.ACTIVE) {
      throw new BadRequestException('ابتدا ثبت حیوان خانگی را کامل کنید');
    }

    const vet = await this.providersService.findBookableVet(dto.vetId);
    const service = (await this.providersService.getVetServices(vet)).find(
      (option) => option.id === dto.serviceId,
    );
    if (!service) throw new BadRequestException('خدمت انتخاب‌شده معتبر نیست');

    const startsAt = new Date(dto.startsAt);
    if (startsAt.getTime() <= Date.now()) {
      throw new BadRequestException('زمان انتخاب‌شده گذشته است');
    }

    const id = await this.dataSource.transaction(async (manager) => {
      // Serialize bookings per vet so two owners can't take the same slot.
      await manager.query('SELECT pg_advisory_xact_lock(hashtext($1))', [
        `booking:${vet.userId}`,
      ]);
      await this.availabilityService.assertSlotAvailable(
        vet.userId,
        startsAt,
        service.durationMinutes,
      );
      const reservation = await manager.save(
        manager.create(Reservation, {
          ownerId,
          petId: pet.id,
          vetId: vet.userId,
          clinicId: vet.clinicId,
          serviceName: service.name,
          serviceDescription: dto.note ?? service.description,
          scheduledAt: startsAt,
          durationMinutes: service.durationMinutes,
          price: service.basePrice,
          status: ReservationStatus.PENDING,
        }),
      );
      await manager.insert(ReservationEvent, {
        reservationId: reservation.id,
        type: 'created',
        message: 'رزرو توسط صاحب پت ثبت شد',
        actorId: ownerId,
      });
      return reservation.id;
    });

    for (const recipient of [vet.userId, vet.clinicId]) {
      if (recipient) {
        await this.notificationsService.notify(recipient, {
          type: NotificationType.RESERVATION,
          title: 'درخواست نوبت جدید',
          body: `درخواست نوبت «${service.name}» برای ${pet.name ?? 'یک پت'} ثبت شد.`,
          data: { reservationId: id },
          dedupeKey: `booking-created:${id}:${recipient}`,
        });
      }
    }
    return this.findOne(ownerId, id);
  }

  async list(
    ownerId: string,
    query: QueryMyReservationsDto,
  ): Promise<Paginated<ReturnType<BookingsService['toListItem']>>> {
    const qb = this.reservationsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pet', 'pet')
      .leftJoinAndSelect('r.vet', 'vet')
      .where('r.ownerId = :ownerId', { ownerId });
    if (query.petId) qb.andWhere('r.petId = :petId', { petId: query.petId });

    if (query.tab === 'past') {
      qb.andWhere('(r.status NOT IN (:...active) OR r.scheduledAt < now())', {
        active: ACTIVE,
      }).orderBy('r.scheduledAt', 'DESC');
    } else {
      qb.andWhere('r.status IN (:...active) AND r.scheduledAt >= now()', {
        active: ACTIVE,
      }).orderBy('r.scheduledAt', 'ASC');
    }

    const [reservations, total] = await qb
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    const [clinics, payments] = await Promise.all([
      this.loadClinics(reservations),
      this.reservationPayments.stateFor(reservations),
    ]);
    return paginated(
      reservations.map((r) => ({
        ...this.toListItem(r, clinics),
        ...payments.get(r.id)!,
      })),
      total,
      query,
    );
  }

  async findOne(ownerId: string, id: string) {
    const reservation = await this.reservationsRepository.findOne({
      where: { id, ownerId },
      relations: { pet: true, vet: true },
    });
    if (!reservation) throw new NotFoundException('رزرو یافت نشد');

    const [clinics, events, review, payments] = await Promise.all([
      this.loadClinics([reservation]),
      this.eventsRepository.find({
        where: { reservationId: id },
        order: { createdAt: 'ASC' },
      }),
      this.findReview(reservation),
      this.reservationPayments.stateFor([reservation]),
    ]);
    const clinic = reservation.clinicId
      ? clinics.get(reservation.clinicId)
      : null;

    return {
      ...this.toListItem(reservation, clinics),
      ...payments.get(reservation.id)!,
      serviceDescription: reservation.serviceDescription,
      cancelReason: reservation.cancelReason,
      clinicNote: reservation.clinicNote,
      clinicDetails: clinic
        ? {
            id: clinic.userId,
            name: clinic.name,
            phone: clinic.phone,
            address: clinic.address,
          }
        : null,
      canCancel: this.canCancel(reservation),
      canReview: reservation.status === ReservationStatus.COMPLETED && !review,
      review,
      history: events.map((event) => ({
        type: event.type,
        message: event.message,
        at: event.createdAt,
      })),
    };
  }

  async cancel(ownerId: string, id: string, reason?: string) {
    const reservation = await this.getOwned(ownerId, id);
    if (!this.canCancel(reservation)) {
      throw new BadRequestException('این رزرو قابل لغو نیست');
    }
    await this.reservationsRepository.update(id, {
      status: ReservationStatus.CANCELLED,
      cancelReason: reason ?? 'لغو توسط صاحب پت',
      cancelledAt: new Date(),
    });
    await this.eventsRepository.insert({
      reservationId: id,
      type: 'cancelled',
      message: reason
        ? `رزرو توسط صاحب پت لغو شد: ${reason}`
        : 'رزرو توسط صاحب پت لغو شد',
      actorId: ownerId,
    });
    for (const recipient of [reservation.vetId, reservation.clinicId]) {
      if (recipient) {
        await this.notificationsService.notify(recipient, {
          type: NotificationType.RESERVATION,
          title: 'لغو نوبت',
          body: `نوبت «${reservation.serviceName}» توسط صاحب پت لغو شد.`,
          data: { reservationId: id },
          dedupeKey: `booking-cancelled:${id}:${recipient}`,
        });
      }
    }
    return this.findOne(ownerId, id);
  }

  /** What the app needs to pre-fill "reserve again" for a past booking. */
  async rebook(ownerId: string, id: string) {
    const reservation = await this.getOwned(ownerId, id);
    if (!reservation.vetId) {
      throw new BadRequestException('این رزرو دامپزشک مشخصی ندارد');
    }
    let vet: VetProfile;
    try {
      vet = await this.providersService.findBookableVet(reservation.vetId);
    } catch {
      throw new ConflictException('این دامپزشک دیگر در دسترس نیست');
    }
    const services = await this.providersService.getVetServices(vet);
    const service = services.find((s) => s.name === reservation.serviceName);
    return {
      petId: reservation.petId,
      vetId: vet.userId,
      clinicId: vet.clinicId,
      serviceId: service?.id ?? null,
      serviceName: reservation.serviceName,
      nextAvailableAt: await this.availabilityService.nextAvailable(
        vet.userId,
        service?.durationMinutes,
      ),
    };
  }

  // ---- reviews ----

  async review(ownerId: string, id: string, dto: CreateReviewDto) {
    const reservation = await this.getOwned(ownerId, id);
    if (reservation.status !== ReservationStatus.COMPLETED) {
      throw new BadRequestException(
        'فقط پس از انجام ویزیت می‌توانید نظر ثبت کنید',
      );
    }
    if (!reservation.vetId && !reservation.clinicId) {
      throw new BadRequestException(
        'برای این رزرو ارائه‌دهنده‌ای ثبت نشده است',
      );
    }
    try {
      // A reservation yields one review; it waits for admin approval.
      if (reservation.vetId) {
        await this.vetReviewsRepository.insert({
          vetId: reservation.vetId,
          authorId: ownerId,
          reservationId: id,
          rating: dto.rating,
          comment: dto.comment,
          status: ApprovalStatus.PENDING,
        });
      } else {
        await this.clinicReviewsRepository.insert({
          clinicId: reservation.clinicId!,
          authorId: ownerId,
          reservationId: id,
          rating: dto.rating,
          comment: dto.comment,
          status: ApprovalStatus.PENDING,
        });
      }
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('برای این رزرو قبلاً نظر ثبت شده است');
      }
      throw error;
    }
    return this.findReview(reservation);
  }

  async getReview(ownerId: string, id: string) {
    const reservation = await this.getOwned(ownerId, id);
    const review = await this.findReview(reservation);
    if (!review) throw new NotFoundException('نظری ثبت نشده است');
    return review;
  }

  // ---- helpers ----

  private async getOwned(ownerId: string, id: string): Promise<Reservation> {
    const reservation = await this.reservationsRepository.findOne({
      where: { id, ownerId },
    });
    if (!reservation) throw new NotFoundException('رزرو یافت نشد');
    return reservation;
  }

  private canCancel(reservation: Reservation): boolean {
    return (
      ACTIVE.includes(reservation.status) &&
      reservation.scheduledAt.getTime() > Date.now()
    );
  }

  private async findReview(reservation: Reservation) {
    const review =
      (await this.vetReviewsRepository.findOne({
        where: { reservationId: reservation.id },
      })) ??
      (await this.clinicReviewsRepository.findOne({
        where: { reservationId: reservation.id },
      }));
    return review
      ? {
          id: review.id,
          rating: review.rating,
          comment: review.comment,
          status: review.status,
          reply: review.reply,
          createdAt: review.createdAt,
        }
      : null;
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

  private toListItem(r: Reservation, clinics: Map<string, Clinic>) {
    const clinic = r.clinicId ? clinics.get(r.clinicId) : undefined;
    return {
      id: r.id,
      code: `BK-${r.number}`,
      status: r.status,
      statusLabel: STATUS_LABELS[r.status],
      serviceName: r.serviceName,
      price: r.price,
      scheduledAt: r.scheduledAt,
      durationMinutes: r.durationMinutes,
      pet: r.pet
        ? {
            id: r.pet.id,
            name: r.pet.name,
            photoUrl: r.pet.photoUrl,
            type: r.pet.type,
            breed: r.pet.breed,
          }
        : null,
      vet: r.vet
        ? {
            id: r.vet.id,
            fullName: r.vet.fullName,
            profilePictureUrl: r.vet.profilePictureUrl,
          }
        : null,
      clinic: clinic
        ? { id: clinic.userId, name: clinic.name, logoUrl: clinic.logoUrl }
        : null,
      createdAt: r.createdAt,
    };
  }
}
