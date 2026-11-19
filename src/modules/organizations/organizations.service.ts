import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { randomUUID } from 'node:crypto';
import { DataSource, Repository } from 'typeorm';
import { Paginated, paginated } from '../../common/dto/pagination-query.dto';
import { OrganizationKind } from '../../common/enums/admin-panel.enums';
import {
  ClinicActivityStatus,
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
import {
  AnimalDto,
  ChangeOrganizationStatusDto,
  CreateOrganizationDto,
  QueryOrganizationsDto,
  ServiceItemDto,
  ShiftDto,
  UpdateAnimalDto,
  UpdateOrganizationDto,
  UpdateServiceItemDto,
} from './dto/organization.dto';
import { Organization } from './entities/organization.entity';

const ROLE_BY_KIND: Record<OrganizationKind, UserRole> = {
  [OrganizationKind.PETSHOP]: UserRole.PETSHOP,
  [OrganizationKind.SHELTER]: UserRole.SHELTER,
};

const LABEL_BY_KIND: Record<OrganizationKind, string> = {
  [OrganizationKind.PETSHOP]: 'پت‌شاپ',
  [OrganizationKind.SHELTER]: 'پناهگاه',
};

const PROFILE_FIELDS = [
  'name',
  'about',
  'licenseNumber',
  'phone',
  'secondaryPhone',
  'website',
  'instagram',
  'province',
  'city',
  'address',
  'latitude',
  'longitude',
  'capacity',
  'adminNotes',
] as const;

export const MAX_PHOTOS = 20;

@Injectable()
export class OrganizationsService {
  constructor(
    @InjectRepository(Organization)
    private readonly organizationsRepository: Repository<Organization>,
    private readonly dataSource: DataSource,
    private readonly usersService: UsersService,
  ) {}

  async findAll(
    kind: OrganizationKind,
    query: QueryOrganizationsDto,
  ): Promise<Paginated<ReturnType<OrganizationsService['toListItem']>>> {
    const qb = this.organizationsRepository
      .createQueryBuilder('org')
      .innerJoinAndSelect('org.user', 'user')
      .where('org.kind = :kind', { kind })
      .andWhere('user.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(org.name ILIKE :s OR user.fullName ILIKE :s OR user.phoneNumber ILIKE :s OR user.email ILIKE :s OR org.phone ILIKE :s)',
        { s: `%${query.search}%` },
      );
    }
    for (const key of [
      'province',
      'city',
      'verificationStatus',
      'activityStatus',
    ] as const) {
      if (query[key])
        qb.andWhere(`org.${key} = :${key}`, { [key]: query[key] });
    }

    const [items, total] = await qb
      .orderBy('org.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getManyAndCount();
    return paginated(
      items.map((org) => this.toListItem(org)),
      total,
      query,
    );
  }

  async getStats(kind: OrganizationKind) {
    const rows = await this.organizationsRepository
      .createQueryBuilder('org')
      .innerJoin('org.user', 'user')
      .select('org.verificationStatus', 'verification')
      .addSelect('org.activityStatus', 'activity')
      .addSelect('COUNT(*)', 'count')
      .where('org.kind = :kind', { kind })
      .andWhere('user.deletedAt IS NULL')
      .groupBy('org.verificationStatus')
      .addGroupBy('org.activityStatus')
      .getRawMany<{
        verification: ClinicVerificationStatus;
        activity: ClinicActivityStatus;
        count: string;
      }>();
    const stats = { total: 0, pendingApproval: 0, approved: 0, suspended: 0 };
    for (const row of rows) {
      const count = Number(row.count);
      stats.total += count;
      if (row.verification === ClinicVerificationStatus.PENDING)
        stats.pendingApproval += count;
      if (row.verification === ClinicVerificationStatus.APPROVED)
        stats.approved += count;
      if (row.activity === ClinicActivityStatus.SUSPENDED)
        stats.suspended += count;
    }
    return stats;
  }

  async findOne(kind: OrganizationKind, id: string) {
    return this.toDetail(await this.getOrThrow(kind, id));
  }

  async create(kind: OrganizationKind, dto: CreateOrganizationDto) {
    const phoneNumber = normalizePhoneNumber(dto.managerPhone);
    const email = dto.email?.toLowerCase();
    await this.assertUnique({ phoneNumber, email });

    try {
      const userId = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            role: ROLE_BY_KIND[kind],
            fullName: dto.managerName,
            phoneNumber,
            email,
            notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
          }),
        );
        await manager.save(
          manager.create(Organization, {
            userId: user.id,
            kind,
            ...this.pickProfile(dto),
            latitude: dto.latitude === undefined ? null : String(dto.latitude),
            longitude:
              dto.longitude === undefined ? null : String(dto.longitude),
          } as Partial<Organization>),
        );
        return user.id;
      });
      return await this.findOne(kind, userId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }
  }

  async update(kind: OrganizationKind, id: string, dto: UpdateOrganizationDto) {
    const org = await this.getOrThrow(kind, id);
    const phoneNumber =
      dto.managerPhone === undefined
        ? undefined
        : normalizePhoneNumber(dto.managerPhone);
    const email = dto.email?.toLowerCase();
    await this.assertUnique(
      {
        phoneNumber:
          phoneNumber !== org.user.phoneNumber ? phoneNumber : undefined,
        email: email !== org.user.email ? email : undefined,
      },
      id,
    );

    const userChanges: Partial<User> = {};
    if (dto.managerName !== undefined) userChanges.fullName = dto.managerName;
    if (email !== undefined) userChanges.email = email;
    if (phoneNumber !== undefined) userChanges.phoneNumber = phoneNumber;
    const profileChanges = this.pickProfile(dto);
    if (dto.latitude !== undefined)
      profileChanges.latitude = String(dto.latitude);
    if (dto.longitude !== undefined)
      profileChanges.longitude = String(dto.longitude);

    try {
      await this.dataSource.transaction(async (manager) => {
        if (Object.keys(userChanges).length > 0)
          await manager.update(User, id, userChanges);
        if (Object.keys(profileChanges).length > 0) {
          await manager.update(Organization, id, profileChanges);
        }
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }
    return this.findOne(kind, id);
  }

  async changeStatus(
    kind: OrganizationKind,
    id: string,
    dto: ChangeOrganizationStatusDto,
  ) {
    const org = await this.getOrThrow(kind, id);
    const orgChanges: Partial<Organization> = {};
    const userChanges: Partial<User> = {};
    if (dto.verificationStatus)
      orgChanges.verificationStatus = dto.verificationStatus;
    if (dto.activityStatus) {
      orgChanges.activityStatus = dto.activityStatus;
      userChanges.isSuspended =
        dto.activityStatus === ClinicActivityStatus.SUSPENDED;
    }
    if (dto.reason !== undefined)
      userChanges.statusChangeReason = dto.reason || null;

    await this.dataSource.transaction(async (manager) => {
      if (Object.keys(orgChanges).length > 0) {
        await manager.update(Organization, org.userId, orgChanges);
      }
      if (Object.keys(userChanges).length > 0) {
        await manager.update(User, org.userId, userChanges);
      }
    });
    return this.findOne(kind, id);
  }

  async remove(kind: OrganizationKind, id: string): Promise<void> {
    const org = await this.getOrThrow(kind, id);
    await this.usersService.softDeleteAccount(org.user);
  }

  // ---- media ----

  async setLogo(kind: OrganizationKind, id: string, url: string | null) {
    const org = await this.getOrThrow(kind, id);
    await this.organizationsRepository.update(id, { logoUrl: url });
    if (org.logoUrl) await removeUploadUrls([org.logoUrl]);
    return this.findOne(kind, id);
  }

  async addPhoto(kind: OrganizationKind, id: string, url: string) {
    const org = await this.getOrThrow(kind, id);
    if (org.photos.length >= MAX_PHOTOS) {
      await removeUploadUrls([url]);
      throw new BadRequestException(`حداکثر ${MAX_PHOTOS} تصویر مجاز است`);
    }
    await this.organizationsRepository.update(id, {
      photos: [...org.photos, url],
    });
    return this.findOne(kind, id);
  }

  async removePhoto(kind: OrganizationKind, id: string, index: number) {
    const org = await this.getOrThrow(kind, id);
    const url = org.photos[index];
    if (!url) throw new NotFoundException('تصویر یافت نشد');
    await this.organizationsRepository.update(id, {
      photos: org.photos.filter((_, i) => i !== index),
    });
    await removeUploadUrls([url]);
    return this.findOne(kind, id);
  }

  // ---- shifts / categories / services / animals ----

  async setShifts(kind: OrganizationKind, id: string, shifts: ShiftDto[]) {
    await this.getOrThrow(kind, id);
    for (const shift of shifts) {
      if (!shift.isClosed && shift.opensAt >= shift.closesAt) {
        throw new BadRequestException('ساعت شروع باید قبل از ساعت پایان باشد');
      }
    }
    await this.organizationsRepository.update(id, { shifts });
    return this.findOne(kind, id);
  }

  async setCategories(
    kind: OrganizationKind,
    id: string,
    categories: string[],
  ) {
    if (kind !== OrganizationKind.PETSHOP) {
      throw new BadRequestException('دسته‌بندی محصولات فقط برای پت‌شاپ است');
    }
    await this.getOrThrow(kind, id);
    await this.organizationsRepository.update(id, {
      categories: [...new Set(categories)],
    });
    return this.findOne(kind, id);
  }

  async addService(kind: OrganizationKind, id: string, dto: ServiceItemDto) {
    const org = await this.getOrThrow(kind, id);
    const services = [
      ...org.services,
      {
        id: randomUUID(),
        name: dto.name,
        description: dto.description ?? null,
      },
    ];
    await this.organizationsRepository.update(id, { services });
    return this.findOne(kind, id);
  }

  async updateService(
    kind: OrganizationKind,
    id: string,
    itemId: string,
    dto: UpdateServiceItemDto,
  ) {
    const org = await this.getOrThrow(kind, id);
    const item = org.services.find((service) => service.id === itemId);
    if (!item) throw new NotFoundException('خدمت یافت نشد');
    if (dto.name !== undefined) item.name = dto.name;
    if (dto.description !== undefined) item.description = dto.description;
    await this.organizationsRepository.update(id, { services: org.services });
    return this.findOne(kind, id);
  }

  async removeService(kind: OrganizationKind, id: string, itemId: string) {
    const org = await this.getOrThrow(kind, id);
    if (!org.services.some((service) => service.id === itemId)) {
      throw new NotFoundException('خدمت یافت نشد');
    }
    await this.organizationsRepository.update(id, {
      services: org.services.filter((service) => service.id !== itemId),
    });
    return this.findOne(kind, id);
  }

  async addAnimal(
    kind: OrganizationKind,
    id: string,
    dto: AnimalDto,
    photoUrl: string | null,
  ) {
    this.assertShelter(kind);
    const org = await this.getOrThrow(kind, id);
    if (org.capacity !== null && org.animals.length >= org.capacity) {
      if (photoUrl) await removeUploadUrls([photoUrl]);
      throw new ConflictException('ظرفیت پناهگاه تکمیل است');
    }
    const animals = [
      ...org.animals,
      {
        id: randomUUID(),
        name: dto.name,
        species: dto.species,
        age: dto.age ?? null,
        gender: dto.gender ?? null,
        description: dto.description ?? null,
        photoUrl,
        isAdopted: dto.isAdopted ?? false,
      },
    ];
    await this.organizationsRepository.update(id, { animals });
    return this.findOne(kind, id);
  }

  async updateAnimal(
    kind: OrganizationKind,
    id: string,
    animalId: string,
    dto: UpdateAnimalDto,
  ) {
    this.assertShelter(kind);
    const org = await this.getOrThrow(kind, id);
    const animal = org.animals.find((item) => item.id === animalId);
    if (!animal) throw new NotFoundException('حیوان یافت نشد');
    Object.assign(
      animal,
      Object.fromEntries(
        Object.entries(dto).filter(([, v]) => v !== undefined),
      ),
    );
    await this.organizationsRepository.update(id, { animals: org.animals });
    return this.findOne(kind, id);
  }

  async removeAnimal(kind: OrganizationKind, id: string, animalId: string) {
    this.assertShelter(kind);
    const org = await this.getOrThrow(kind, id);
    const animal = org.animals.find((item) => item.id === animalId);
    if (!animal) throw new NotFoundException('حیوان یافت نشد');
    await this.organizationsRepository.update(id, {
      animals: org.animals.filter((item) => item.id !== animalId),
    });
    if (animal.photoUrl) await removeUploadUrls([animal.photoUrl]);
    return this.findOne(kind, id);
  }

  // ---- helpers ----

  private assertShelter(kind: OrganizationKind) {
    if (kind !== OrganizationKind.SHELTER) {
      throw new BadRequestException('این بخش فقط برای پناهگاه است');
    }
  }

  async getOrThrow(kind: OrganizationKind, id: string): Promise<Organization> {
    const org = await this.organizationsRepository.findOne({
      where: { userId: id, kind },
      relations: { user: true },
    });
    if (!org?.user || org.user.deletedAt) {
      throw new NotFoundException(`${LABEL_BY_KIND[kind]} یافت نشد`);
    }
    return org;
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

  private pickProfile(dto: UpdateOrganizationDto): Partial<Organization> {
    const picked: Record<string, unknown> = {};
    for (const field of PROFILE_FIELDS) {
      if (dto[field] !== undefined) picked[field] = dto[field];
    }
    return picked;
  }

  private toListItem(org: Organization) {
    return {
      id: org.userId,
      kind: org.kind,
      name: org.name,
      logoUrl: org.logoUrl,
      managerName: org.user.fullName,
      managerPhone: org.user.phoneNumber,
      province: org.province,
      city: org.city,
      phone: org.phone,
      verificationStatus: org.verificationStatus,
      activityStatus: org.activityStatus,
      createdAt: org.createdAt,
    };
  }

  private toDetail(org: Organization) {
    return {
      ...this.toListItem(org),
      email: org.user.email,
      about: org.about,
      licenseNumber: org.licenseNumber,
      secondaryPhone: org.secondaryPhone,
      website: org.website,
      instagram: org.instagram,
      address: org.address,
      latitude: org.latitude,
      longitude: org.longitude,
      photos: org.photos,
      shifts: org.shifts,
      categories: org.categories,
      services: org.services,
      animals: org.animals,
      capacity: org.capacity,
      statusChangeReason: org.user.statusChangeReason,
      adminNotes: org.adminNotes,
      lastLoginAt: org.user.lastLoginAt,
      updatedAt: org.updatedAt,
    };
  }
}
