import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { Paginated, paginated } from '../../common/dto/pagination-query.dto';
import { NotificationType } from '../../common/enums/owner-app.enums';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  NotificationPreferences,
  User,
} from '../users/entities/user.entity';
import {
  QueryNotificationsDto,
  RegisterDeviceDto,
  UpdateNotificationSettingsDto,
} from './dto/notification.dto';
import { DeviceToken, Notification } from './entities/notification.entities';

export interface NotifyInput {
  type: NotificationType;
  title: string;
  body: string;
  data?: Record<string, string>;
  /** Same key for the same user = delivered once. */
  dedupeKey?: string;
}

/** Which preference switch gates each notification type. */
const PREFERENCE_BY_TYPE: Partial<
  Record<NotificationType, keyof NotificationPreferences>
> = {
  [NotificationType.RESERVATION]: 'reservationAlerts',
  [NotificationType.VACCINE_REMINDER]: 'vaccineReminders',
  [NotificationType.MEDICATION_REMINDER]: 'medicationReminders',
  [NotificationType.CHECKUP_REMINDER]: 'checkupReminders',
  [NotificationType.PAYMENT]: 'paymentAlerts',
  [NotificationType.DISCOUNT]: 'discountAlerts',
};

@Injectable()
export class NotificationsService {
  private readonly logger = new Logger(NotificationsService.name);

  constructor(
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    @InjectRepository(DeviceToken)
    private readonly devicesRepository: Repository<DeviceToken>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  /**
   * Stores an in-app notification unless the user switched that kind off.
   * Never throws: a failed notification must not fail the action behind it.
   * (No push provider is wired up yet, so device tokens are only stored.)
   */
  async notify(userId: string, input: NotifyInput): Promise<void> {
    try {
      const preferenceKey = PREFERENCE_BY_TYPE[input.type];
      if (preferenceKey) {
        const user = await this.usersRepository.findOne({
          where: { id: userId },
          select: { id: true, notificationPreferences: true },
        });
        if (!user) return;
        if (user.notificationPreferences?.[preferenceKey] === false) return;
      }
      await this.notificationsRepository
        .createQueryBuilder()
        .insert()
        .values({
          userId,
          type: input.type,
          title: input.title,
          body: input.body,
          data: input.data ?? {},
          dedupeKey: input.dedupeKey ?? null,
        })
        .orIgnore()
        .execute();
    } catch (error) {
      this.logger.error(
        `Could not store notification for ${userId}: ${(error as Error).message}`,
      );
    }
  }

  async list(
    userId: string,
    query: QueryNotificationsDto,
  ): Promise<Paginated<Notification>> {
    const [items, total] = await this.notificationsRepository.findAndCount({
      where: { userId, ...(query.unreadOnly ? { readAt: IsNull() } : {}) },
      order: { createdAt: 'DESC' },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    });
    return paginated(items, total, query);
  }

  async unreadCount(userId: string): Promise<{ count: number }> {
    return {
      count: await this.notificationsRepository.count({
        where: { userId, readAt: IsNull() },
      }),
    };
  }

  async markRead(userId: string, id: string): Promise<void> {
    const result = await this.notificationsRepository.update(
      { id, userId, readAt: IsNull() },
      { readAt: new Date() },
    );
    if (!result.affected) {
      const exists = await this.notificationsRepository.exists({
        where: { id, userId },
      });
      if (!exists) throw new NotFoundException('اعلان یافت نشد');
    }
  }

  async markAllRead(userId: string): Promise<void> {
    await this.notificationsRepository.update(
      { userId, readAt: IsNull() },
      { readAt: new Date() },
    );
  }

  async remove(userId: string, id: string): Promise<void> {
    const result = await this.notificationsRepository.delete({ id, userId });
    if (!result.affected) throw new NotFoundException('اعلان یافت نشد');
  }

  // ---- devices ----

  /** A token belongs to one user; signing in elsewhere moves it. */
  async registerDevice(userId: string, dto: RegisterDeviceDto): Promise<void> {
    await this.devicesRepository.upsert(
      { userId, token: dto.token, platform: dto.platform },
      ['token'],
    );
  }

  async removeDevice(userId: string, token: string): Promise<void> {
    await this.devicesRepository.delete({ userId, token });
  }

  // ---- settings ----

  async getSettings(userId: string) {
    const user = await this.usersRepository.findOneOrFail({
      where: { id: userId },
      select: { id: true, notificationPreferences: true },
    });
    return this.withDefaults(user.notificationPreferences);
  }

  async updateSettings(userId: string, dto: UpdateNotificationSettingsDto) {
    const current = await this.getSettings(userId);
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    );
    const next = { ...current, ...changes };
    await this.usersRepository.update(userId, {
      notificationPreferences: next,
    });
    return next;
  }

  private withDefaults(stored?: Partial<NotificationPreferences>) {
    return {
      ...DEFAULT_NOTIFICATION_PREFERENCES,
      vaccineReminders: true,
      medicationReminders: true,
      checkupReminders: true,
      paymentAlerts: true,
      discountAlerts: true,
      ...stored,
    } as Required<NotificationPreferences>;
  }
}
