import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { VetCollaborationStatus } from '../../common/enums/vet-collaboration-status.enum';
import { VetStatusLogType } from '../../common/enums/vet-status-log-type.enum';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { normalizePhoneNumber } from '../../common/validators/is-iranian-phone.validator';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  User,
} from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { CreateVetDto } from './dto/create-vet.dto';
import { QueryVetsDto } from './dto/query-vets.dto';
import { UpdateVetDto } from './dto/update-vet.dto';
import {
  VetDetailDto,
  VetListItemDto,
  VetListResponseDto,
  VetStatsDto,
  VetStatusLogDto,
} from './dto/vet-response.dto';
import { VetClinicService } from './entities/vet-clinic-service.entity';
import { VetProfile } from './entities/vet-profile.entity';
import { VetReview } from './entities/vet-review.entity';
import { VetStatusLog } from './entities/vet-status-log.entity';

export interface VetStatusChange {
  verificationStatus?: ApprovalStatus;
  collaborationStatus?: VetCollaborationStatus;
  reason?: string;
}

const PROFILE_FIELDS = [
  'medicalCouncilNumber',
  'nationalCode',
  'gender',
  'bio',
  'city',
  'primarySpecialty',
  'subSpecialties',
  'highestDegree',
  'university',
  'graduationYear',
  'languages',
  'clinicName',
  'clinicPhone',
  'clinicAddress',
  'instagram',
  'telegram',
  'linkedin',
  'adminNotes',
] as const;

@Injectable()
export class VetsService {
  constructor(
    @InjectRepository(VetProfile)
    private readonly profilesRepository: Repository<VetProfile>,
    @InjectRepository(VetStatusLog)
    private readonly logsRepository: Repository<VetStatusLog>,
    @InjectRepository(VetClinicService)
    private readonly servicesRepository: Repository<VetClinicService>,
    @InjectRepository(VetReview)
    private readonly reviewsRepository: Repository<VetReview>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  async findAll(query: QueryVetsDto): Promise<VetListResponseDto> {
    const qb = this.profilesRepository
      .createQueryBuilder('vet')
      .innerJoinAndSelect('vet.user', 'user')
      .where('user.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(user.fullName ILIKE :search OR user.phoneNumber ILIKE :search OR user.email ILIKE :search OR vet.medicalCouncilNumber ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }
    if (query.city) qb.andWhere('vet.city = :city', { city: query.city });
    if (query.specialty) {
      qb.andWhere('vet.primarySpecialty = :specialty', {
        specialty: query.specialty,
      });
    }
    if (query.verificationStatus) {
      qb.andWhere('vet.verificationStatus = :verificationStatus', {
        verificationStatus: query.verificationStatus,
      });
    }
    if (query.collaborationStatus) {
      qb.andWhere('vet.collaborationStatus = :collaborationStatus', {
        collaborationStatus: query.collaborationStatus,
      });
    }

    const [profiles, total] = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();

    return {
      items: profiles.map((profile) => this.toListItem(profile)),
      total,
      page: query.page,
      limit: query.limit,
    };
  }

  async findAllForExport(query: QueryVetsDto): Promise<VetListItemDto[]> {
    const { items } = await this.findAll({ ...query, page: 1, limit: 10000 });
    return items;
  }

  async findOne(id: string): Promise<VetDetailDto> {
    const profile = await this.getVetOrThrow(id);
    const stats = await this.getStats(id);
    const { user } = profile;

    return {
      ...this.toListItem(profile),
      dateOfBirth: user.dateOfBirth,
      gender: profile.gender,
      nationalCode: profile.nationalCode,
      bio: profile.bio,
      subSpecialties: profile.subSpecialties,
      highestDegree: profile.highestDegree,
      university: profile.university,
      graduationYear: profile.graduationYear,
      languages: profile.languages,
      clinicPhone: profile.clinicPhone,
      clinicAddress: profile.clinicAddress,
      instagram: profile.instagram,
      telegram: profile.telegram,
      linkedin: profile.linkedin,
      notificationPreferences:
        user.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
      statusChangeReason: user.statusChangeReason,
      adminNotes: profile.adminNotes,
      lastLoginAt: user.lastLoginAt,
      rating: {
        average: stats.average,
        count: stats.stats.approvedReviews,
      },
      stats: stats.stats,
    };
  }

  async create(dto: CreateVetDto, actorId: string): Promise<VetDetailDto> {
    if (
      dto.dateOfBirth &&
      new Date(`${dto.dateOfBirth}T00:00:00.000Z`) > new Date()
    ) {
      throw new BadRequestException('تاریخ تولد نمی‌تواند در آینده باشد');
    }

    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const email = dto.email?.toLowerCase();
    await this.assertUnique({
      phoneNumber,
      email,
      medicalCouncilNumber: dto.medicalCouncilNumber,
    });

    let userId: string;
    try {
      userId = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            role: UserRole.VET,
            fullName: dto.fullName,
            phoneNumber,
            email,
            dateOfBirth: dto.dateOfBirth,
            notificationPreferences: {
              ...DEFAULT_NOTIFICATION_PREFERENCES,
              ...dto.notificationPreferences,
            },
          }),
        );
        await manager.save(
          manager.create(VetProfile, {
            userId: user.id,
            ...this.pickProfileFields(dto),
          }),
        );
        await manager.insert(VetStatusLog, {
          vetId: user.id,
          type: VetStatusLogType.ACCOUNT_CREATED,
          actorId,
        });
        return user.id;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'شماره موبایل، ایمیل یا شماره نظام قبلاً ثبت شده است',
        );
      }
      throw error;
    }

    return this.findOne(userId);
  }

  async update(
    id: string,
    dto: UpdateVetDto,
    actorId: string,
  ): Promise<VetDetailDto> {
    const profile = await this.getVetOrThrow(id);
    const { user } = profile;

    const phoneNumber =
      dto.phoneNumber !== undefined
        ? normalizePhoneNumber(dto.phoneNumber)
        : undefined;
    const email = dto.email?.toLowerCase();
    await this.assertUnique(
      {
        phoneNumber: phoneNumber !== user.phoneNumber ? phoneNumber : undefined,
        email: email !== user.email ? email : undefined,
        medicalCouncilNumber:
          dto.medicalCouncilNumber !== profile.medicalCouncilNumber
            ? dto.medicalCouncilNumber
            : undefined,
      },
      id,
    );

    const userChanges: Partial<User> = {};
    if (dto.fullName !== undefined) userChanges.fullName = dto.fullName;
    if (email !== undefined) userChanges.email = email;
    if (phoneNumber !== undefined) userChanges.phoneNumber = phoneNumber;
    if (dto.dateOfBirth !== undefined)
      userChanges.dateOfBirth = dto.dateOfBirth;
    if (dto.notificationPreferences !== undefined) {
      userChanges.notificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...user.notificationPreferences,
        ...dto.notificationPreferences,
      };
    }
    const profileChanges = this.pickProfileFields(dto);

    try {
      await this.dataSource.transaction(async (manager) => {
        if (Object.keys(userChanges).length > 0) {
          await manager.update(User, id, userChanges);
        }
        if (Object.keys(profileChanges).length > 0) {
          await manager.update(VetProfile, id, profileChanges);
        }
        await this.applyStatusChanges(
          manager,
          profile,
          {
            verificationStatus: dto.verificationStatus,
            collaborationStatus: dto.collaborationStatus,
            reason: dto.statusChangeReason,
          },
          actorId,
        );
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'شماره موبایل، ایمیل یا شماره نظام قبلاً ثبت شده است',
        );
      }
      throw error;
    }

    return this.findOne(id);
  }

  async changeStatus(
    id: string,
    changes: VetStatusChange,
    actorId: string,
    manager?: EntityManager,
  ): Promise<VetDetailDto> {
    const profile = await this.getVetOrThrow(id);
    if (manager) {
      await this.applyStatusChanges(manager, profile, changes, actorId);
    } else {
      await this.dataSource.transaction((tx) =>
        this.applyStatusChanges(tx, profile, changes, actorId),
      );
    }
    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const profile = await this.getVetOrThrow(id);
    await this.usersService.softDeleteAccount(profile.user);
    // Frees the medical council number for a future registration.
    await this.profilesRepository.update(id, {
      medicalCouncilNumber: `deleted_${Date.now()}_${id}_${profile.medicalCouncilNumber}`,
    });
  }

  async updateProfilePicture(
    id: string,
    profilePictureUrl: string,
  ): Promise<VetDetailDto> {
    const profile = await this.getVetOrThrow(id);
    await this.usersService.update(id, { profilePictureUrl });
    if (profile.user.profilePictureUrl) {
      await removeUploadUrls([profile.user.profilePictureUrl]);
    }
    return this.findOne(id);
  }

  async removeProfilePicture(id: string): Promise<VetDetailDto> {
    const profile = await this.getVetOrThrow(id);
    await this.dataSource
      .createQueryBuilder()
      .update(User)
      .set({ profilePictureUrl: () => 'NULL' })
      .where('id = :id', { id })
      .execute();
    if (profile.user.profilePictureUrl) {
      await removeUploadUrls([profile.user.profilePictureUrl]);
    }
    return this.findOne(id);
  }

  async findStatusLogs(id: string): Promise<VetStatusLogDto[]> {
    await this.getVetOrThrow(id);
    const logs = await this.logsRepository.find({
      where: { vetId: id },
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

  /** Loads a vet profile with its user; throws 404 for missing/deleted vets. */
  async getVetOrThrow(id: string): Promise<VetProfile> {
    const profile = await this.profilesRepository.findOne({
      where: { userId: id },
      relations: { user: true },
    });
    if (!profile?.user || profile.user.deletedAt) {
      throw new NotFoundException('دامپزشک یافت نشد');
    }
    return profile;
  }

  private async applyStatusChanges(
    manager: EntityManager,
    profile: VetProfile,
    changes: VetStatusChange,
    actorId: string,
  ): Promise<void> {
    const reason = changes.reason?.trim() || null;
    const logs: Partial<VetStatusLog>[] = [];
    const profileChanges: Partial<VetProfile> = {};
    const userChanges: Partial<User> = {};

    if (
      changes.verificationStatus !== undefined &&
      changes.verificationStatus !== profile.verificationStatus
    ) {
      profileChanges.verificationStatus = changes.verificationStatus;
      logs.push({
        type: VetStatusLogType.VERIFICATION_STATUS,
        status: changes.verificationStatus,
      });
    }
    if (
      changes.collaborationStatus !== undefined &&
      changes.collaborationStatus !== profile.collaborationStatus
    ) {
      profileChanges.collaborationStatus = changes.collaborationStatus;
      userChanges.isSuspended =
        changes.collaborationStatus === VetCollaborationStatus.SUSPENDED;
      logs.push({
        type: VetStatusLogType.COLLABORATION_STATUS,
        status: changes.collaborationStatus,
      });
    }
    if (changes.reason !== undefined) userChanges.statusChangeReason = reason;

    if (Object.keys(profileChanges).length > 0) {
      await manager.update(VetProfile, profile.userId, profileChanges);
    }
    if (Object.keys(userChanges).length > 0) {
      await manager.update(User, profile.userId, userChanges);
    }
    if (logs.length > 0) {
      await manager.insert(
        VetStatusLog,
        logs.map((log) => ({
          ...log,
          vetId: profile.userId,
          reason,
          actorId,
        })),
      );
    }
  }

  private async assertUnique(
    values: {
      phoneNumber?: string;
      email?: string;
      medicalCouncilNumber?: string;
    },
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
    if (values.medicalCouncilNumber) {
      const existing = await this.profilesRepository.findOne({
        where: { medicalCouncilNumber: values.medicalCouncilNumber },
      });
      if (existing && existing.userId !== exceptId) {
        throw new ConflictException('این شماره نظام قبلاً ثبت شده است');
      }
    }
  }

  private pickProfileFields(dto: UpdateVetDto): Partial<VetProfile> {
    const picked: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (dto[field] !== undefined) picked[field] = dto[field];
    }
    return picked;
  }

  private async getStats(
    id: string,
  ): Promise<{ average: number; stats: VetStatsDto }> {
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
      .where('review.vetId = :id', { id })
      .getRawOne<{
        approved: string;
        pending: string;
        average: string;
        positive: string;
      }>();
    const [totalServices, activeServices] = await Promise.all([
      this.servicesRepository.count({ where: { vetId: id } }),
      this.servicesRepository.count({ where: { vetId: id, isActive: true } }),
    ]);

    const approvedReviews = Number(reviews?.approved ?? 0);
    const positive = Number(reviews?.positive ?? 0);

    return {
      average: Math.round(Number(reviews?.average ?? 0) * 10) / 10,
      stats: {
        activeServices,
        totalServices,
        approvedReviews,
        pendingReviews: Number(reviews?.pending ?? 0),
        satisfactionPercent: approvedReviews
          ? Math.round((positive / approvedReviews) * 100)
          : 0,
      },
    };
  }

  private toListItem(profile: VetProfile): VetListItemDto {
    const { user } = profile;
    return {
      id: profile.userId,
      fullName: user.fullName,
      email: user.email,
      phoneNumber: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
      primarySpecialty: profile.primarySpecialty,
      clinicName: profile.clinicName,
      city: profile.city,
      medicalCouncilNumber: profile.medicalCouncilNumber,
      verificationStatus: profile.verificationStatus,
      collaborationStatus: profile.collaborationStatus,
      createdAt: user.createdAt,
    };
  }
}
