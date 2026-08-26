import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { normalizePhoneNumber } from '../../common/validators/is-iranian-phone.validator';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { Address } from '../addresses/entities/address.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { AdminUserResponseDto } from './dto/admin-user-response.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';
import { DEFAULT_NOTIFICATION_PREFERENCES, User } from './entities/user.entity';
import { UsersService } from './users.service';

@Injectable()
export class AdminUsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(Address)
    private readonly addressesRepository: Repository<Address>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    private readonly usersService: UsersService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async findAll(query: QueryAdminUsersDto): Promise<{
    items: AdminUserResponseDto[];
    total: number;
    page: number;
    limit: number;
  }> {
    const qb = this.usersRepository
      .createQueryBuilder('user')
      .where('user.deletedAt IS NULL');

    if (query.search) {
      qb.andWhere(
        '(user.fullName ILIKE :search OR user.phoneNumber ILIKE :search OR user.email ILIKE :search)',
        { search: `%${query.search}%` },
      );
    }

    if (query.city) {
      const addresses = await this.addressesRepository.find({
        where: { city: query.city },
        select: { userId: true },
      });
      const userIdsForCity = [...new Set(addresses.map((a) => a.userId))];
      qb.andWhere('user.id IN (:...userIdsForCity)', {
        userIdsForCity: userIdsForCity.length ? userIdsForCity : [null],
      });
    }

    if (query.status || query.plan) {
      const subQb = this.subscriptionsRepository
        .createQueryBuilder('subscription')
        .select('subscription.userId', 'userId')
        .distinctOn(['subscription.userId'])
        .orderBy('subscription.userId')
        .addOrderBy('subscription.createdAt', 'DESC');
      if (query.status) {
        subQb.andWhere('subscription.status = :status', {
          status: query.status,
        });
      }
      if (query.plan) {
        subQb.andWhere('subscription.plan = :plan', { plan: query.plan });
      }
      const matching = await subQb.getRawMany<{ userId: string }>();
      const matchingIds = matching.map((m) => m.userId);
      qb.andWhere('user.id IN (:...matchingIds)', {
        matchingIds: matchingIds.length ? matchingIds : [null],
      });
    }

    const total = await qb.getCount();

    const users = await qb
      .orderBy('user.createdAt', 'DESC')
      .skip((query.page - 1) * query.limit)
      .take(query.limit)
      .getMany();

    const items = await this.toResponseList(users);

    return { items, total, page: query.page, limit: query.limit };
  }

  async findOne(id: string): Promise<AdminUserResponseDto> {
    const user = await this.getUserOrThrow(id);
    const [item] = await this.toResponseList([user]);
    return item;
  }

  async update(
    id: string,
    dto: UpdateAdminUserDto,
  ): Promise<AdminUserResponseDto> {
    await this.getUserOrThrow(id);

    const userChanges: Partial<User> = {};
    if (dto.fullName !== undefined) userChanges.fullName = dto.fullName;
    if (dto.email !== undefined) userChanges.email = dto.email;
    if (dto.phoneNumber !== undefined)
      userChanges.phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    if (dto.dateOfBirth !== undefined)
      userChanges.dateOfBirth = dto.dateOfBirth;
    if (dto.statusChangeReason !== undefined)
      userChanges.statusChangeReason = dto.statusChangeReason;
    if (dto.adminNotes !== undefined) userChanges.adminNotes = dto.adminNotes;
    if (dto.notificationPreferences !== undefined) {
      const current = await this.usersService.findById(id);
      userChanges.notificationPreferences = {
        ...DEFAULT_NOTIFICATION_PREFERENCES,
        ...current?.notificationPreferences,
        ...dto.notificationPreferences,
      };
    }
    if (Object.keys(userChanges).length > 0) {
      await this.usersService.update(id, userChanges);
    }

    if (dto.city !== undefined || dto.fullAddress !== undefined) {
      await this.upsertDefaultAddress(id, dto.city, dto.fullAddress);
    }

    if (
      dto.subscriptionPlan !== undefined ||
      dto.subscriptionStatus !== undefined
    ) {
      await this.subscriptionsService.updateLatest(id, {
        plan: dto.subscriptionPlan,
        status: dto.subscriptionStatus,
      });
    }

    return this.findOne(id);
  }

  async remove(id: string): Promise<void> {
    const user = await this.getUserOrThrow(id);
    await this.usersService.softDeleteAccount(user);
  }

  async updateProfilePicture(
    id: string,
    profilePictureUrl: string,
  ): Promise<AdminUserResponseDto> {
    const user = await this.getUserOrThrow(id);
    const previousUrl = user.profilePictureUrl;

    await this.usersService.update(id, { profilePictureUrl });

    if (previousUrl) {
      await removeUploadUrls([previousUrl]);
    }

    return this.findOne(id);
  }

  async removeProfilePicture(id: string): Promise<AdminUserResponseDto> {
    const user = await this.getUserOrThrow(id);
    const previousUrl = user.profilePictureUrl;

    await this.usersRepository
      .createQueryBuilder()
      .update(User)
      .set({ profilePictureUrl: () => 'NULL' })
      .where('id = :id', { id })
      .execute();

    if (previousUrl) {
      await removeUploadUrls([previousUrl]);
    }

    return this.findOne(id);
  }

  async findAllForExport(
    query: QueryAdminUsersDto,
  ): Promise<AdminUserResponseDto[]> {
    const { items } = await this.findAll({ ...query, page: 1, limit: 10000 });
    return items;
  }

  private async upsertDefaultAddress(
    userId: string,
    city: string | undefined,
    fullAddress: string | undefined,
  ): Promise<void> {
    const [existing] = await this.addressesRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
      take: 1,
    });

    if (existing) {
      await this.addressesRepository.update(existing.id, {
        ...(city !== undefined ? { city } : {}),
        ...(fullAddress !== undefined ? { fullAddress } : {}),
      });
      return;
    }

    if (city === undefined || fullAddress === undefined) {
      throw new NotFoundException(
        'برای ثبت آدرس جدید، شهر و نشانی کامل هر دو الزامی هستند',
      );
    }

    const address = this.addressesRepository.create({
      userId,
      title: 'محل سکونت',
      city,
      fullAddress,
      latitude: 0,
      longitude: 0,
      isDefault: true,
    });
    await this.addressesRepository.save(address);
  }

  private async getUserOrThrow(id: string): Promise<User> {
    const user = await this.usersService.findById(id);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return user;
  }

  private async toResponseList(users: User[]): Promise<AdminUserResponseDto[]> {
    if (users.length === 0) return [];

    const userIds = users.map((u) => u.id);

    const [petCounts, defaultAddresses, subscriptions] = await Promise.all([
      this.petsRepository
        .createQueryBuilder('pet')
        .select('pet.ownerId', 'ownerId')
        .addSelect('COUNT(*)', 'count')
        .where('pet.ownerId IN (:...userIds)', { userIds })
        .groupBy('pet.ownerId')
        .getRawMany<{ ownerId: string; count: string }>(),
      this.addressesRepository
        .createQueryBuilder('address')
        .distinctOn(['address.userId'])
        .where('address.userId IN (:...userIds)', { userIds })
        .orderBy('address.userId')
        .addOrderBy('address.isDefault', 'DESC')
        .addOrderBy('address.createdAt', 'DESC')
        .getMany(),
      this.subscriptionsService.findLatestByUserIds(userIds),
    ]);

    const petCountMap = new Map(
      petCounts.map((p) => [p.ownerId, parseInt(p.count, 10)]),
    );
    const addressMap = new Map(defaultAddresses.map((a) => [a.userId, a]));

    return users.map((user) => {
      const subscription = subscriptions.get(user.id);
      const address = addressMap.get(user.id);
      return {
        id: user.id,
        fullName: user.fullName,
        email: user.email,
        phoneNumber: user.phoneNumber,
        dateOfBirth: user.dateOfBirth,
        profilePictureUrl: user.profilePictureUrl,
        city: address?.city ?? null,
        fullAddress: address?.fullAddress ?? null,
        petsCount: petCountMap.get(user.id) ?? 0,
        subscriptionPlan: subscription?.plan ?? SubscriptionPlan.FREE,
        subscriptionStatus: subscription?.status ?? SubscriptionStatus.ACTIVE,
        notificationPreferences:
          user.notificationPreferences ?? DEFAULT_NOTIFICATION_PREFERENCES,
        statusChangeReason: user.statusChangeReason,
        adminNotes: user.adminNotes,
        createdAt: user.createdAt,
      };
    });
  }
}
