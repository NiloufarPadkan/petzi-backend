import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import {
  ClinicActivityStatus,
  ClinicLogType,
  ClinicVerificationStatus,
} from '../../common/enums/clinic-enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { normalizePhoneNumber } from '../../common/validators/is-iranian-phone.validator';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  User,
} from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import {
  ClinicDetailDto,
  ClinicListItemDto,
  ClinicListResponseDto,
  ClinicLogDto,
  ClinicStatsDto,
} from './dto/clinic-response.dto';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { QueryClinicsDto } from './dto/query-clinics.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';
import { ClinicImage } from './entities/clinic-image.entity';
import { ClinicLog } from './entities/clinic-log.entity';
import { ClinicReview } from './entities/clinic-review.entity';
import { ClinicServiceItem } from './entities/clinic-service-item.entity';
import { Clinic } from './entities/clinic.entity';

export interface ClinicStatusChange {
  verificationStatus?: ClinicVerificationStatus;
  activityStatus?: ClinicActivityStatus;
  reason?: string;
}

export type ClinicMediaField = 'logoUrl' | 'coverImageUrl';

const CLINIC_FIELDS = [
  'name',
  'type',
  'about',
  'licenseNumber',
  'registrationNumber',
  'foundedAt',
  'brandColor',
  'staffCount',
  'phone',
  'secondaryPhone',
  'website',
  'instagram',
  'province',
  'city',
  'postalCode',
  'address',
  'latitude',
  'longitude',
  'acceptsOnlineBooking',
  'isListedInSearch',
  'bookingCutoffHours',
  'adminNotes',
] as const;

@Injectable()
export class ClinicsService {
  constructor(
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    @InjectRepository(ClinicLog)
    private readonly logsRepository: Repository<ClinicLog>,
    @InjectRepository(ClinicServiceItem)
    private readonly servicesRepository: Repository<ClinicServiceItem>,
    @InjectRepository(ClinicImage)
    private readonly imagesRepository: Repository<ClinicImage>,
    @InjectRepository(ClinicReview)
    private readonly reviewsRepository: Repository<ClinicReview>,
    @InjectRepository(VetProfile)
    private readonly vetsRepository: Repository<VetProfile>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  async findAll(query: QueryClinicsDto): Promise<ClinicListResponseDto> {
    const qb = this.clinicsRepository
      .createQueryBuilder('clinic')
      .innerJoinAndSelect('clinic.user', 'user')
      .where('user.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(clinic.name ILIKE :search OR user.fullName ILIKE :search OR user.phoneNumber ILIKE :search OR user.email ILIKE :search OR clinic.phone ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.city) qb.andWhere('clinic.city = :city', { city: query.city });
    if (query.type) qb.andWhere('clinic.type = :type', { type: query.type });
    if (query.verificationStatus) {
      qb.andWhere('clinic.verificationStatus = :verificationStatus', {
        verificationStatus: query.verificationStatus,
      });
    }
    if (query.activityStatus) {
      qb.andWhere('clinic.activityStatus = :activityStatus', {
        activityStatus: query.activityStatus,
      });
    }

    const [clinics, total] = await qb
      .orderBy('clinic.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: clinics.map((clinic) => this.toListItem(clinic)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findAllForExport(query: QueryClinicsDto): Promise<ClinicListItemDto[]> {
    const { items } = await this.findAll({ ...query, page: 1, limit: 10000 });
    return items;
  }

  async findOne(id: string): Promise<ClinicDetailDto> {
    const clinic = await this.getClinicOrThrow(id);
    const { average, stats } = await this.getStats(id);
    const { user } = clinic;

    return {
      ...this.toListItem(clinic),
      managerName: user.fullName,
      managerPhone: user.phoneNumber,
      email: user.email,
      about: clinic.about,
      licenseNumber: clinic.licenseNumber,
      registrationNumber: clinic.registrationNumber,
      foundedAt: clinic.foundedAt,
      brandColor: clinic.brandColor,
      staffCount: clinic.staffCount,
      secondaryPhone: clinic.secondaryPhone,
      website: clinic.website,
      instagram: clinic.instagram,
      postalCode: clinic.postalCode,
      address: clinic.address,
      latitude: clinic.latitude,
      longitude: clinic.longitude,
      coverImageUrl: clinic.coverImageUrl,
      acceptsOnlineBooking: clinic.acceptsOnlineBooking,
      isListedInSearch: clinic.isListedInSearch,
      bookingCutoffHours: clinic.bookingCutoffHours,
      notificationPreferences:
        user.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
      statusChangeReason: user.statusChangeReason,
      adminNotes: clinic.adminNotes,
      lastLoginAt: user.lastLoginAt,
      rating: { average, count: stats.approvedReviews },
      stats,
    };
  }

  async create(
    dto: CreateClinicDto,
    actorId: string,
  ): Promise<ClinicDetailDto> {
    const phoneNumber = normalizePhoneNumber(dto.managerPhone);
    const email = dto.email?.toLowerCase();
    await this.assertUnique({ phoneNumber, email });

    let userId: string;
    try {
      userId = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            role: UserRole.CLINIC,
            fullName: dto.managerName,
            phoneNumber,
            email,
            notificationPreferences: {
              ...DEFAULT_NOTIFICATION_PREFERENCES,
              ...dto.notificationPreferences,
            },
          }),
        );
        await manager.save(
          manager.create(Clinic, {
            userId: user.id,
            ...this.pickClinicFields(dto),
          }),
        );
        await manager.insert(ClinicLog, {
          clinicId: user.id,
          type: ClinicLogType.ACCOUNT_CREATED,
          actorId,
        });
        return user.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }

    return this.findOne(userId);
  }

  async update(
    id: string,
    dto: UpdateClinicDto,
    actorId: string,
  ): Promise<ClinicDetailDto> {
    const clinic = await this.getClinicOrThrow(id);
    const { user } = clinic;

    const phoneNumber =
      dto.managerPhone !== undefined
        ? normalizePhoneNumber(dto.managerPhone)
        : undefined;
    const email = dto.email?.toLowerCase();
    await this.assertUnique(
      {
        phoneNumber: phoneNumber !== user.phoneNumber ? phoneNumber : undefined,
        email: email !== user.email ? email : undefined,
      },
      id,
    );

    const userChanges: Partial<User> = {};
    if (dto.managerName !== undefined) userChanges.fullName = dto.managerName;
    if (email !== undefined) userChanges.email = email;
    if (phoneNumber !== undefined) userChanges.phoneNumber = phoneNumber;
    if (dto.notificationPreferences !== undefined) {
      userChanges.notificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...user.notificationPreferences,
        ...dto.notificationPreferences,
      };
    }
    const clinicChanges = this.pickClinicFields(dto);

    try {
      await this.dataSource.transaction(async (manager) => {
        if (Object.keys(userChanges).length > 0) {
          await manager.update(User, id, userChanges);
        }
        if (Object.keys(clinicChanges).length > 0) {
          await manager.update(Clinic, id, clinicChanges);
        }
        await this.applyStatusChanges(
          manager,
          clinic,
          {
            verificationStatus: dto.verificationStatus,
            activityStatus: dto.activityStatus,
            reason: dto.statusChangeReason,
          },
          actorId,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }

    return this.findOne(id);
  }

  async changeStatus(
    id: string,
    changes: ClinicStatusChange,
    actorId: string,
  ): Promise<ClinicDetailDto> {
    const clinic = await this.getClinicOrThrow(id);
    await this.dataSource.transaction((manager) =>
      this.applyStatusChanges(manager, clinic, changes, actorId),
    );
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const clinic = await this.getClinicOrThrow(id);
    await this.usersService.softDeleteAccount(clinic.user);
    await this.vetsRepository.update({ clinicId: id }, { clinicId: null });
  }

  async setMedia(
    id: string,
    field: ClinicMediaField,
    url: string | null,
  ): Promise<ClinicDetailDto> {
    const clinic = await this.getClinicOrThrow(id);
    const previousUrl = clinic[field];
    await this.clinicsRepository.update(id, { [field]: url });
    if (previousUrl) await removeUploadUrls([previousUrl]);
    return this.findOne(id);
  }

  async findLogs(id: string, type?: ClinicLogType): Promise<ClinicLogDto[]> {
    await this.getClinicOrThrow(id);
    const logs = await this.logsRepository.find({
      where: { clinicId: id, ...(type ? { type } : {}) },
      relations: { actor: true },
      order: { createdAt: 'DESC' },
    });
    return logs.map((log) => ({
      id: log.id,
      type: log.type,
      status: log.status,
      reason: log.reason,
      actor: log.actor
        ? { id: log.actor.id, fullName: log.actor.fullName }
        : null,
      createdAt: log.createdAt,
    }));
  }

  async addLog(
    clinicId: string,
    type: ClinicLogType,
    reason: string,
    actorId: string,
  ): Promise<void> {
    await this.logsRepository.insert({ clinicId, type, reason, actorId });
  }

  /** Loads a clinic with its account; throws 404 for missing/deleted ones. */
  async getClinicOrThrow(id: string): Promise<Clinic> {
    const clinic = await this.clinicsRepository.findOne({
      where: { userId: id },
      relations: { user: true },
    });
    if (!clinic?.user || clinic.user.deletedAt) {
      throw new NotFoundException('کلینیک یافت نشد');
    }
    return clinic;
  }

  private async applyStatusChanges(
    manager: EntityManager,
    clinic: Clinic,
    changes: ClinicStatusChange,
    actorId: string,
  ): Promise<void> {
    const reason = changes.reason?.trim() || null;
    const logs: Partial<ClinicLog>[] = [];
    const clinicChanges: Partial<Clinic> = {};
    const userChanges: Partial<User> = {};

    if (
      changes.verificationStatus !== undefined &&
      changes.verificationStatus !== clinic.verificationStatus
    ) {
      clinicChanges.verificationStatus = changes.verificationStatus;
      logs.push({
        type: ClinicLogType.VERIFICATION_STATUS,
        status: changes.verificationStatus,
      });
    }
    if (
      changes.activityStatus !== undefined &&
      changes.activityStatus !== clinic.activityStatus
    ) {
      clinicChanges.activityStatus = changes.activityStatus;
      userChanges.isSuspended =
        changes.activityStatus === ClinicActivityStatus.SUSPENDED;
      logs.push({
        type: ClinicLogType.ACTIVITY_STATUS,
        status: changes.activityStatus,
      });
    }
    if (changes.reason !== undefined) userChanges.statusChangeReason = reason;

    if (Object.keys(clinicChanges).length > 0) {
      await manager.update(Clinic, clinic.userId, clinicChanges);
    }
    if (Object.keys(userChanges).length > 0) {
      await manager.update(User, clinic.userId, userChanges);
    }
    if (logs.length > 0) {
      await manager.insert(
        ClinicLog,
        logs.map((log) => ({
          ...log,
          clinicId: clinic.userId,
          reason,
          actorId,
        })),
      );
    }
  }

  private async assertUnique(
    values: { phoneNumber?: string; email?: string },
    exceptId?: string,
  ): Promise<void> {
    if (values.phoneNumber) {
      const existing = await this.usersService.findByPhone(values.phoneNumber);
      if (existing && existing.id !== exceptId) {
        throw new ConflictException('این شماره موبایل قبلاً ثبت شده است');
      }
    }
    if (values.email) {
      const existing = await this.usersService.findByEmail(values.email);
      if (existing && existing.id !== exceptId) {
        throw new ConflictException('این ایمیل قبلاً ثبت شده است');
      }
    }
  }

  private pickClinicFields(dto: UpdateClinicDto): Partial<Clinic> {
    const picked: Record<string, unknown> = {};
    for (const field of CLINIC_FIELDS) {
      if (dto[field] !== undefined) picked[field] = dto[field];
    }
    return picked;
  }

  private async getStats(
    id: string,
  ): Promise<{ average: number; stats: ClinicStatsDto }> {
    const approved = ApprovalStatus.APPROVED;
    const pending = ApprovalStatus.PENDING;
    const reviews = await this.reviewsRepository
      .createQueryBuilder('review')
      .select(
        `COUNT(*) FILTER (WHERE review.status = '${approved}')`,
        'approved',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE review.status = '${pending}')`,
        'pending',
      )
      .addSelect(
        `COALESCE(AVG(review.rating) FILTER (WHERE review.status = '${approved}'), 0)`,
        'average',
      )
      .addSelect(
        `COUNT(*) FILTER (WHERE review.status = '${approved}' AND review.rating >= 4)`,
        'positive',
      )
      .where('review.clinicId = :id', { id })
      .getRawOne<{
        approved: string;
        pending: string;
        average: string;
        positive: string;
      }>();
    const [totalServices, activeServices, vetsCount, imagesCount] =
      await Promise.all([
        this.servicesRepository.count({ where: { clinicId: id } }),
        this.servicesRepository.count({
          where: { clinicId: id, isActive: true },
        }),
        this.vetsRepository
          .createQueryBuilder('vet')
          .innerJoin('vet.user', 'user')
          .where('vet.clinicId = :id', { id })
          .andWhere('user.deletedAt IS NULL')
          .getCount(),
        this.imagesRepository.count({ where: { clinicId: id } }),
      ]);

    const approvedReviews = Number(reviews?.approved ?? 0);
    const positive = Number(reviews?.positive ?? 0);

    return {
      average: Math.round(Number(reviews?.average ?? 0) * 10) / 10,
      stats: {
        activeServices,
        totalServices,
        vetsCount,
        imagesCount,
        approvedReviews,
        pendingReviews: Number(reviews?.pending ?? 0),
        satisfactionPercent: approvedReviews
          ? Math.round((positive / approvedReviews) * 100)
          : 0,
      },
    };
  }

  private toListItem(clinic: Clinic): ClinicListItemDto {
    return {
      id: clinic.userId,
      name: clinic.name,
      logoUrl: clinic.logoUrl,
      type: clinic.type,
      province: clinic.province,
      city: clinic.city,
      phone: clinic.phone,
      verificationStatus: clinic.verificationStatus,
      activityStatus: clinic.activityStatus,
      createdAt: clinic.createdAt,
    };
  }
}
