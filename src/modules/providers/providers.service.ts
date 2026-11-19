import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { ObjectLiteral, Repository, SelectQueryBuilder } from 'typeorm';
import {
  Paginated,
  PaginationQueryDto,
  paginated,
} from '../../common/dto/pagination-query.dto';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import {
  ClinicActivityStatus,
  ClinicVerificationStatus,
} from '../../common/enums/clinic-enums';
import { FavoriteType } from '../../common/enums/owner-app.enums';
import { VetCollaborationStatus } from '../../common/enums/vet-collaboration-status.enum';
import { ClinicImage } from '../clinics/entities/clinic-image.entity';
import { ClinicReview } from '../clinics/entities/clinic-review.entity';
import { ClinicServiceItem } from '../clinics/entities/clinic-service-item.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import { VetClinicService } from '../vets/entities/vet-clinic-service.entity';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import { VetReview } from '../vets/entities/vet-review.entity';
import {
  AvailabilityService,
  DEFAULT_SLOT_MINUTES,
} from './availability.service';
import {
  AvailabilityQueryDto,
  FavoriteDto,
  QueryClinicsDto,
  QueryVetsDto,
} from './dto/providers.dto';
import { FavoriteProvider } from './entities/favorite.entity';

// Correlated sub-selects keep list queries to one round trip.
const VET_RATING_SQL = `(SELECT COALESCE(AVG(rv.rating), 0) FROM vet_reviews rv WHERE rv."vetId" = vet."userId" AND rv.status = 'approved')`;
const VET_REVIEWS_SQL = `(SELECT COUNT(*) FROM vet_reviews rv WHERE rv."vetId" = vet."userId" AND rv.status = 'approved')`;
const VET_MIN_PRICE_SQL = `(SELECT MIN(vs."basePrice") FROM vet_services vs WHERE vs."vetId" = vet."userId" AND vs."isActive" = true)`;
const CLINIC_RATING_SQL = `(SELECT COALESCE(AVG(cr.rating), 0) FROM clinic_reviews cr WHERE cr."clinicId" = clinic."userId" AND cr.status = 'approved')`;
const CLINIC_REVIEWS_SQL = `(SELECT COUNT(*) FROM clinic_reviews cr WHERE cr."clinicId" = clinic."userId" AND cr.status = 'approved')`;
const CLINIC_MIN_PRICE_SQL = `(SELECT MIN(cs."basePrice") FROM clinic_services cs WHERE cs."clinicId" = clinic."userId" AND cs."isActive" = true)`;
const CLINIC_VETS_SQL = `(SELECT COUNT(*) FROM vet_profiles vp WHERE vp."clinicId" = clinic."userId" AND vp."verificationStatus" = 'approved')`;

/** Great-circle distance in km between (:lat, :lng) and a lat/lng column pair. */
const distanceSql = (lat: string, lng: string) =>
  `(6371 * acos(least(1, cos(radians(:lat)) * cos(radians(${lat})) * cos(radians(${lng}) - radians(:lng)) + sin(radians(:lat)) * sin(radians(${lat})))))`;

interface ListMeta {
  rating: number;
  reviews: number;
  minPrice: number | null;
  distanceKm: number | null;
}

export interface ServiceOption {
  id: string;
  source: 'vet' | 'clinic';
  name: string;
  category: string;
  basePrice: number;
  durationMinutes: number;
  description: string | null;
}

@Injectable()
export class ProvidersService {
  constructor(
    @InjectRepository(VetProfile)
    private readonly vetsRepository: Repository<VetProfile>,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    @InjectRepository(VetClinicService)
    private readonly vetServicesRepository: Repository<VetClinicService>,
    @InjectRepository(ClinicServiceItem)
    private readonly clinicServicesRepository: Repository<ClinicServiceItem>,
    @InjectRepository(VetReview)
    private readonly vetReviewsRepository: Repository<VetReview>,
    @InjectRepository(ClinicReview)
    private readonly clinicReviewsRepository: Repository<ClinicReview>,
    @InjectRepository(ClinicImage)
    private readonly imagesRepository: Repository<ClinicImage>,
    @InjectRepository(FavoriteProvider)
    private readonly favoritesRepository: Repository<FavoriteProvider>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    private readonly availabilityService: AvailabilityService,
    private readonly configService: ConfigService,
  ) {}

  // ---- vets ----

  async listVets(userId: string, query: QueryVetsDto) {
    const total = await this.applyVetFilters(
      this.vetQuery(),
      query,
      userId,
    ).getCount();

    const qb = this.applyVetFilters(this.vetQuery(), query, userId)
      .addSelect(VET_RATING_SQL, 'rating')
      .addSelect(VET_REVIEWS_SQL, 'reviews')
      .addSelect(VET_MIN_PRICE_SQL, 'min_price');
    this.addDistance(qb, query, 'clinic.latitude', 'clinic.longitude');
    this.applySort(qb, query);

    const { entities, raw } = await qb
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawAndEntities<Record<string, string | null>>();

    const favorites = await this.favoriteIds(userId, FavoriteType.VET);
    const items = await Promise.all(
      entities.map(async (vet, index) => {
        const item = this.toVetItem(vet, this.meta(raw[index]), favorites);
        return query.includeNextSlot
          ? {
              ...item,
              nextAvailableAt: await this.availabilityService.nextAvailable(
                vet.userId,
              ),
            }
          : item;
      }),
    );
    return paginated(items, total, query);
  }

  async getVet(userId: string, vetId: string) {
    const { entities, raw } = await this.vetQuery()
      .andWhere('vet.userId = :vetId', { vetId })
      .addSelect(VET_RATING_SQL, 'rating')
      .addSelect(VET_REVIEWS_SQL, 'reviews')
      .addSelect(VET_MIN_PRICE_SQL, 'min_price')
      .getRawAndEntities<Record<string, string | null>>();
    const vet = entities[0];
    if (!vet) throw new NotFoundException('دامپزشک یافت نشد');

    const favorites = await this.favoriteIds(userId, FavoriteType.VET);
    const [services, summary, schedule, nextAvailableAt] = await Promise.all([
      this.getVetServices(vet),
      this.reviewSummary(this.vetReviewsRepository, 'vetId', vetId),
      this.availabilityService.getSchedule(vetId),
      this.availabilityService.nextAvailable(vetId),
    ]);

    const clinic = vet.clinic;
    const latitude = clinic?.latitude ?? null;
    const longitude = clinic?.longitude ?? null;
    return {
      ...this.toVetItem(vet, this.meta(raw[0]), favorites),
      bio: vet.bio,
      languages: vet.languages,
      subSpecialties: vet.subSpecialties,
      highestDegree: vet.highestDegree,
      university: vet.university,
      services,
      reviewSummary: summary,
      workingHours: this.describeSchedule(schedule.days),
      nextAvailableAt,
      location: this.location(
        latitude,
        longitude,
        clinic?.address ?? vet.clinicAddress,
      ),
      shareUrl: this.shareUrl('vets', vetId),
    };
  }

  async vetReviews(vetId: string, query: PaginationQueryDto) {
    await this.assertVetExists(vetId);
    return this.reviewPage(this.vetReviewsRepository, 'vetId', vetId, query);
  }

  /** Services a vet offers; falls back to the clinic's list. */
  async getVetServices(vet: VetProfile): Promise<ServiceOption[]> {
    const own = await this.vetServicesRepository.find({
      where: { vetId: vet.userId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    if (own.length > 0) {
      return own.map((s) => ({ ...this.toService(s), source: 'vet' as const }));
    }
    if (!vet.clinicId) return [];
    const shared = await this.clinicServicesRepository.find({
      where: { clinicId: vet.clinicId, isActive: true },
      order: { createdAt: 'ASC' },
    });
    return shared.map((s) => ({
      ...this.toService(s),
      source: 'clinic' as const,
    }));
  }

  /** The vet's slots for a day range, sized to the chosen service. */
  async vetAvailability(vetId: string, query: AvailabilityQueryDto) {
    const vet = await this.assertVetExists(vetId);
    let durationMinutes = DEFAULT_SLOT_MINUTES;
    if (query.serviceId) {
      const service = (await this.getVetServices(vet)).find(
        (s) => s.id === query.serviceId,
      );
      if (!service) throw new BadRequestException('خدمت انتخاب‌شده معتبر نیست');
      durationMinutes = service.durationMinutes;
    }
    return {
      durationMinutes,
      days: await this.availabilityService.getSlots(vetId, {
        from: query.from,
        days: query.days,
        durationMinutes,
      }),
    };
  }

  // ---- clinics ----

  async listClinics(userId: string, query: QueryClinicsDto) {
    const total = await this.applyClinicFilters(
      this.clinicQuery(),
      query,
      userId,
    ).getCount();

    const qb = this.applyClinicFilters(this.clinicQuery(), query, userId)
      .addSelect(CLINIC_RATING_SQL, 'rating')
      .addSelect(CLINIC_REVIEWS_SQL, 'reviews')
      .addSelect(CLINIC_MIN_PRICE_SQL, 'min_price')
      .addSelect(CLINIC_VETS_SQL, 'vet_count');
    this.addDistance(qb, query, 'clinic.latitude', 'clinic.longitude');
    this.applySort(qb, query);

    const { entities, raw } = await qb
      .offset((query.page - 1) * query.limit)
      .limit(query.limit)
      .getRawAndEntities<Record<string, string | null>>();

    const favorites = await this.favoriteIds(userId, FavoriteType.CLINIC);
    return paginated(
      entities.map((clinic, index) =>
        this.toClinicItem(
          clinic,
          this.meta(raw[index]),
          Number(raw[index].vet_count ?? 0),
          favorites,
        ),
      ),
      total,
      query,
    );
  }

  async getClinic(userId: string, clinicId: string) {
    const { entities, raw } = await this.clinicQuery()
      .andWhere('clinic.userId = :clinicId', { clinicId })
      .addSelect(CLINIC_RATING_SQL, 'rating')
      .addSelect(CLINIC_REVIEWS_SQL, 'reviews')
      .addSelect(CLINIC_MIN_PRICE_SQL, 'min_price')
      .addSelect(CLINIC_VETS_SQL, 'vet_count')
      .getRawAndEntities<Record<string, string | null>>();
    const clinic = entities[0];
    if (!clinic) throw new NotFoundException('کلینیک یافت نشد');

    const favorites = await this.favoriteIds(userId, FavoriteType.CLINIC);
    const [services, images, summary, vets] = await Promise.all([
      this.clinicServicesRepository.find({
        where: { clinicId, isActive: true },
        order: { createdAt: 'ASC' },
      }),
      this.imagesRepository.find({
        where: { clinicId },
        order: { createdAt: 'ASC' },
      }),
      this.reviewSummary(this.clinicReviewsRepository, 'clinicId', clinicId),
      this.listVets(userId, {
        page: 1,
        limit: 50,
        sort: 'rating',
        clinicId,
        includeNextSlot: true,
      }),
    ]);

    return {
      ...this.toClinicItem(
        clinic,
        this.meta(raw[0]),
        Number(raw[0].vet_count ?? 0),
        favorites,
      ),
      about: clinic.about,
      coverImageUrl: clinic.coverImageUrl,
      website: clinic.website,
      instagram: clinic.instagram,
      acceptsOnlineBooking: clinic.acceptsOnlineBooking,
      images: images.map((image) => ({
        id: image.id,
        title: image.title,
        category: image.category,
        url: image.fileUrl,
      })),
      services: services.map((s) => ({
        ...this.toService(s),
        source: 'clinic' as const,
      })),
      vets: vets.items,
      reviewSummary: summary,
      location: this.location(
        clinic.latitude,
        clinic.longitude,
        clinic.address,
      ),
      shareUrl: this.shareUrl('clinics', clinicId),
    };
  }

  async clinicReviews(clinicId: string, query: PaginationQueryDto) {
    if (
      !(await this.clinicsRepository.exists({ where: { userId: clinicId } }))
    ) {
      throw new NotFoundException('کلینیک یافت نشد');
    }
    return this.reviewPage(
      this.clinicReviewsRepository,
      'clinicId',
      clinicId,
      query,
    );
  }

  // ---- frequent & favorites ----

  /** The vets this owner booked most often. */
  async frequent(userId: string) {
    const rows = await this.reservationsRepository
      .createQueryBuilder('r')
      .select('r.vetId', 'vetId')
      .addSelect('COUNT(*)', 'count')
      .addSelect('MAX(r.scheduledAt)', 'last')
      .where('r.ownerId = :userId AND r.vetId IS NOT NULL', { userId })
      .andWhere('r.status != :cancelled', {
        cancelled: ReservationStatus.CANCELLED,
      })
      .groupBy('r.vetId')
      .orderBy('count', 'DESC')
      .addOrderBy('last', 'DESC')
      .limit(10)
      .getRawMany<{ vetId: string; count: string }>();
    if (rows.length === 0) return [];

    const ids = rows.map((row) => row.vetId);
    const { entities, raw } = await this.vetQuery()
      .andWhere('vet.userId IN (:...ids)', { ids })
      .addSelect(VET_RATING_SQL, 'rating')
      .addSelect(VET_REVIEWS_SQL, 'reviews')
      .addSelect(VET_MIN_PRICE_SQL, 'min_price')
      .getRawAndEntities<Record<string, string | null>>();
    const favorites = await this.favoriteIds(userId, FavoriteType.VET);
    const byId = new Map(
      entities.map((vet, index) => [
        vet.userId,
        this.toVetItem(vet, this.meta(raw[index]), favorites),
      ]),
    );
    return rows.flatMap((row) => {
      const item = byId.get(row.vetId);
      return item ? [{ ...item, visitCount: Number(row.count) }] : [];
    });
  }

  async listFavorites(userId: string) {
    const favorites = await this.favoritesRepository.find({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    const vetIds = favorites
      .filter((f) => f.providerType === FavoriteType.VET)
      .map((f) => f.providerId);
    const clinicIds = favorites
      .filter((f) => f.providerType === FavoriteType.CLINIC)
      .map((f) => f.providerId);

    const [vets, clinics] = await Promise.all([
      vetIds.length
        ? this.listVets(userId, {
            page: 1,
            limit: 100,
            sort: 'rating',
            favoritesOnly: true,
          })
        : { items: [] },
      clinicIds.length
        ? this.listClinics(userId, {
            page: 1,
            limit: 100,
            sort: 'rating',
            favoritesOnly: true,
          })
        : { items: [] },
    ]);
    return { vets: vets.items, clinics: clinics.items };
  }

  async addFavorite(userId: string, dto: FavoriteDto): Promise<void> {
    if (dto.providerType === FavoriteType.VET)
      await this.assertVetExists(dto.providerId);
    else {
      const exists = await this.clinicsRepository.exists({
        where: { userId: dto.providerId },
      });
      if (!exists) throw new NotFoundException('کلینیک یافت نشد');
    }
    try {
      await this.favoritesRepository.insert({ userId, ...dto });
    } catch (error) {
      // Already saved: adding twice is a no-op.
      if (!(error instanceof Error) || !/duplicate|unique/i.test(error.message))
        throw error;
    }
  }

  async removeFavorite(
    userId: string,
    type: FavoriteType,
    providerId: string,
  ): Promise<void> {
    await this.favoritesRepository.delete({
      userId,
      providerType: type,
      providerId,
    });
  }

  async share(type: FavoriteType, id: string) {
    const name =
      type === FavoriteType.VET
        ? (await this.assertVetExists(id)).user.fullName
        : (await this.clinicsRepository.findOne({ where: { userId: id } }))
            ?.name;
    if (!name) throw new NotFoundException('مورد یافت نشد');
    const url = this.shareUrl(
      type === FavoriteType.VET ? 'vets' : 'clinics',
      id,
    );
    return { title: name, text: `${name} در پتزی`, url };
  }

  // ---- helpers ----

  private vetQuery(): SelectQueryBuilder<VetProfile> {
    return this.vetsRepository
      .createQueryBuilder('vet')
      .innerJoinAndSelect('vet.user', 'user')
      .leftJoinAndSelect('vet.clinic', 'clinic')
      .where('vet.verificationStatus = :approved', {
        approved: ApprovalStatus.APPROVED,
      })
      .andWhere('vet.collaborationStatus = :collab', {
        collab: VetCollaborationStatus.ACTIVE,
      })
      .andWhere('user.deletedAt IS NULL AND user.isSuspended = false');
  }

  private clinicQuery(): SelectQueryBuilder<Clinic> {
    return this.clinicsRepository
      .createQueryBuilder('clinic')
      .innerJoin('clinic.user', 'user')
      .where('clinic.verificationStatus = :approved', {
        approved: ClinicVerificationStatus.APPROVED,
      })
      .andWhere('clinic.activityStatus = :active', {
        active: ClinicActivityStatus.ACTIVE,
      })
      .andWhere('clinic.isListedInSearch = true')
      .andWhere('user.deletedAt IS NULL AND user.isSuspended = false');
  }

  private applyVetFilters(
    qb: SelectQueryBuilder<VetProfile>,
    query: QueryVetsDto,
    userId: string,
  ) {
    if (query.search) {
      qb.andWhere(
        `(user.fullName ILIKE :s OR vet.primarySpecialty ILIKE :s OR clinic.name ILIKE :s OR EXISTS (SELECT 1 FROM vet_services vs2 WHERE vs2."vetId" = vet."userId" AND vs2."isActive" = true AND vs2.name ILIKE :s))`,
        { s: `%${query.search}%` },
      );
    }
    if (query.city) qb.andWhere('vet.city = :city', { city: query.city });
    if (query.specialty)
      qb.andWhere('vet.primarySpecialty = :specialty', {
        specialty: query.specialty,
      });
    if (query.clinicId)
      qb.andWhere('vet.clinicId = :clinicId', { clinicId: query.clinicId });
    if (query.minRating !== undefined) {
      qb.andWhere(`${VET_RATING_SQL} >= :minRating`, {
        minRating: query.minRating,
      });
    }
    this.applyPriceRange(qb, query, 'vet_services', 'vet."userId"', 'vetId');
    if (query.favoritesOnly) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM favorite_providers f WHERE f."userId" = :me AND f."providerType" = 'vet' AND f."providerId" = vet."userId")`,
        { me: userId },
      );
    }
    return qb;
  }

  private applyClinicFilters(
    qb: SelectQueryBuilder<Clinic>,
    query: QueryClinicsDto,
    userId: string,
  ) {
    if (query.search) {
      qb.andWhere(
        `(clinic.name ILIKE :s OR clinic.city ILIKE :s OR EXISTS (SELECT 1 FROM clinic_services cs2 WHERE cs2."clinicId" = clinic."userId" AND cs2."isActive" = true AND cs2.name ILIKE :s))`,
        { s: `%${query.search}%` },
      );
    }
    if (query.city) qb.andWhere('clinic.city = :city', { city: query.city });
    if (query.minRating !== undefined) {
      qb.andWhere(`${CLINIC_RATING_SQL} >= :minRating`, {
        minRating: query.minRating,
      });
    }
    this.applyPriceRange(
      qb,
      query,
      'clinic_services',
      'clinic."userId"',
      'clinicId',
    );
    if (query.favoritesOnly) {
      qb.andWhere(
        `EXISTS (SELECT 1 FROM favorite_providers f WHERE f."userId" = :me AND f."providerType" = 'clinic' AND f."providerId" = clinic."userId")`,
        { me: userId },
      );
    }
    return qb;
  }

  private applyPriceRange(
    qb: SelectQueryBuilder<VetProfile> | SelectQueryBuilder<Clinic>,
    query: { minPrice?: number; maxPrice?: number },
    table: string,
    ownerColumn: string,
    foreignKey: string,
  ) {
    if (query.minPrice === undefined && query.maxPrice === undefined) return;
    const bounds = [
      query.minPrice !== undefined ? 'p."basePrice" >= :minPrice' : null,
      query.maxPrice !== undefined ? 'p."basePrice" <= :maxPrice' : null,
    ].filter(Boolean);
    (qb as SelectQueryBuilder<ObjectLiteral>).andWhere(
      `EXISTS (SELECT 1 FROM ${table} p WHERE p."${foreignKey}" = ${ownerColumn} AND p."isActive" = true AND ${bounds.join(' AND ')})`,
      { minPrice: query.minPrice, maxPrice: query.maxPrice },
    );
  }

  private addDistance(
    qb: SelectQueryBuilder<VetProfile> | SelectQueryBuilder<Clinic>,
    query: { lat?: number; lng?: number },
    latColumn: string,
    lngColumn: string,
  ) {
    if (query.lat === undefined || query.lng === undefined) return;
    (qb as SelectQueryBuilder<ObjectLiteral>)
      .addSelect(distanceSql(latColumn, lngColumn), 'distance')
      .setParameters({ lat: query.lat, lng: query.lng });
  }

  private applySort(
    qb: SelectQueryBuilder<VetProfile> | SelectQueryBuilder<Clinic>,
    query: { sort: string; lat?: number; lng?: number },
  ) {
    const q = qb as SelectQueryBuilder<ObjectLiteral>;
    switch (query.sort) {
      case 'reviews':
        q.orderBy('reviews', 'DESC');
        break;
      case 'price_asc':
        q.orderBy('min_price', 'ASC', 'NULLS LAST');
        break;
      case 'price_desc':
        q.orderBy('min_price', 'DESC', 'NULLS LAST');
        break;
      case 'nearest':
        if (query.lat === undefined || query.lng === undefined) {
          throw new BadRequestException(
            'برای مرتب‌سازی بر اساس نزدیکی، موقعیت مکانی لازم است',
          );
        }
        q.orderBy('distance', 'ASC', 'NULLS LAST');
        break;
      default:
        q.orderBy('rating', 'DESC').addOrderBy('reviews', 'DESC');
    }
  }

  private meta(raw: Record<string, string | null>): ListMeta {
    return {
      rating: Math.round(Number(raw.rating ?? 0) * 10) / 10,
      reviews: Number(raw.reviews ?? 0),
      minPrice:
        raw.min_price === null || raw.min_price === undefined
          ? null
          : Number(raw.min_price),
      distanceKm:
        raw.distance === null || raw.distance === undefined
          ? null
          : Math.round(Number(raw.distance) * 10) / 10,
    };
  }

  private toVetItem(vet: VetProfile, meta: ListMeta, favorites: Set<string>) {
    const clinic = vet.clinic;
    return {
      id: vet.userId,
      fullName: vet.user.fullName,
      profilePictureUrl: vet.user.profilePictureUrl,
      medicalCouncilNumber: vet.medicalCouncilNumber,
      primarySpecialty: vet.primarySpecialty,
      experienceYears: vet.graduationYear
        ? Math.max(0, new Date().getFullYear() - vet.graduationYear)
        : null,
      city: vet.city,
      clinic: clinic
        ? { id: clinic.userId, name: clinic.name, logoUrl: clinic.logoUrl }
        : vet.clinicName
          ? { id: null, name: vet.clinicName, logoUrl: null }
          : null,
      address: clinic?.address ?? vet.clinicAddress,
      rating: { average: meta.rating, count: meta.reviews },
      minPrice: meta.minPrice,
      distanceKm: meta.distanceKm,
      isFavorite: favorites.has(vet.userId),
    };
  }

  private toClinicItem(
    clinic: Clinic,
    meta: ListMeta,
    vetCount: number,
    favorites: Set<string>,
  ) {
    return {
      id: clinic.userId,
      name: clinic.name,
      type: clinic.type,
      logoUrl: clinic.logoUrl,
      city: clinic.city,
      address: clinic.address,
      rating: { average: meta.rating, count: meta.reviews },
      minPrice: meta.minPrice,
      vetCount,
      distanceKm: meta.distanceKm,
      isFavorite: favorites.has(clinic.userId),
    };
  }

  private toService(s: {
    id: string;
    name: string;
    category: string;
    basePrice: number;
    durationMinutes: number;
    description: string | null;
  }) {
    return {
      id: s.id,
      name: s.name,
      category: s.category,
      basePrice: s.basePrice,
      durationMinutes: s.durationMinutes,
      description: s.description,
    };
  }

  private async favoriteIds(
    userId: string,
    type: FavoriteType,
  ): Promise<Set<string>> {
    const rows = await this.favoritesRepository.find({
      where: { userId, providerType: type },
      select: { providerId: true },
    });
    return new Set(rows.map((row) => row.providerId));
  }

  /** A vet that is approved, active and not suspended (404 otherwise). */
  findBookableVet(vetId: string): Promise<VetProfile> {
    return this.assertVetExists(vetId);
  }

  private async assertVetExists(vetId: string): Promise<VetProfile> {
    const vet = await this.vetQuery()
      .andWhere('vet.userId = :vetId', { vetId })
      .getOne();
    if (!vet) throw new NotFoundException('دامپزشک یافت نشد');
    return vet;
  }

  private async reviewSummary(
    repo: Repository<VetReview> | Repository<ClinicReview>,
    column: 'vetId' | 'clinicId',
    id: string,
  ) {
    const rows = await (repo as Repository<VetReview>)
      .createQueryBuilder('r')
      .select('r.rating', 'rating')
      .addSelect('COUNT(*)', 'count')
      .where(`r.${column} = :id AND r.status = :approved`, {
        id,
        approved: ApprovalStatus.APPROVED,
      })
      .groupBy('r.rating')
      .getRawMany<{ rating: number; count: string }>();
    const distribution: Record<number, number> = {
      1: 0,
      2: 0,
      3: 0,
      4: 0,
      5: 0,
    };
    let total = 0;
    let sum = 0;
    for (const row of rows) {
      distribution[row.rating] = Number(row.count);
      total += Number(row.count);
      sum += Number(row.count) * row.rating;
    }
    return {
      average: total ? Math.round((sum / total) * 10) / 10 : 0,
      count: total,
      distribution,
    };
  }

  private async reviewPage(
    repo: Repository<VetReview> | Repository<ClinicReview>,
    column: 'vetId' | 'clinicId',
    id: string,
    query: PaginationQueryDto,
  ): Promise<Paginated<unknown>> {
    const [reviews, total] = await (repo as Repository<VetReview>).findAndCount(
      {
        where: { [column]: id, status: ApprovalStatus.APPROVED },
        relations: { author: true },
        order: { createdAt: 'DESC' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      },
    );
    return paginated(
      reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        reply: review.reply,
        repliedAt: review.repliedAt,
        author: review.author
          ? {
              fullName: review.author.fullName,
              profilePictureUrl: review.author.profilePictureUrl,
            }
          : null,
        createdAt: review.createdAt,
      })),
      total,
      query,
    );
  }

  private describeSchedule(
    days: Map<number, { start: string; end: string }[]>,
  ) {
    return Array.from({ length: 7 }, (_, dayOfWeek) => ({
      dayOfWeek,
      isClosed: !days.has(dayOfWeek),
      shifts: (days.get(dayOfWeek) ?? []).map(({ start, end }) => ({
        start,
        end,
      })),
    }));
  }

  private location(
    latitude: number | null,
    longitude: number | null,
    address: string | null,
  ) {
    const hasPoint = latitude !== null && longitude !== null;
    return {
      latitude,
      longitude,
      address,
      // Deep links the app can hand to a maps app.
      directions: hasPoint
        ? {
            googleMaps: `https://www.google.com/maps/dir/?api=1&destination=${latitude},${longitude}`,
            geo: `geo:${latitude},${longitude}?q=${latitude},${longitude}`,
          }
        : null,
    };
  }

  private shareUrl(kind: 'vets' | 'clinics', id: string): string | null {
    const base = this.configService.get<string>('publicSiteUrl');
    return base ? `${base.replace(/\/$/, '')}/${kind}/${id}` : null;
  }
}
