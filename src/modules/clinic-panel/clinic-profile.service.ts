import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicsService } from '../clinics/clinics.service';
import { Clinic } from '../clinics/entities/clinic.entity';
import { User } from '../users/entities/user.entity';
import { DEFAULT_PANEL_NOTIFICATIONS } from './clinic-panel.constants';
import type { ClinicContext } from './clinic-panel.guard';
import {
  PanelUpdateClinicDto,
  UpdatePanelNotificationsDto,
} from './dto/profile.dto';

@Injectable()
export class ClinicProfileService {
  constructor(
    private readonly clinicsService: ClinicsService,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
  ) {}

  async getProfile(ctx: ClinicContext) {
    const [clinic, account] = await Promise.all([
      this.clinicsService.findOne(ctx.clinicId),
      this.usersRepository.findOneBy({ id: ctx.userId }),
    ]);
    return {
      clinic,
      me: {
        userId: ctx.userId,
        isManager: ctx.isManager,
        memberId: ctx.memberId,
        permissions: [...ctx.permissions],
        fullName: account?.fullName ?? null,
        phoneNumber: account?.phoneNumber ?? null,
        email: account?.email ?? null,
        profilePictureUrl: account?.profilePictureUrl ?? null,
      },
    };
  }

  async update(ctx: ClinicContext, dto: PanelUpdateClinicDto) {
    await this.clinicsService.update(ctx.clinicId, dto, ctx.userId);
    return this.getProfile(ctx);
  }

  async setMedia(
    ctx: ClinicContext,
    field: 'logoUrl' | 'coverImageUrl',
    url: string | null,
  ) {
    await this.clinicsService.setMedia(ctx.clinicId, field, url);
    return this.getProfile(ctx);
  }

  async getNotifications(ctx: ClinicContext) {
    const clinic = await this.clinicsRepository.findOne({
      where: { userId: ctx.clinicId },
      select: { userId: true, panelNotifications: true },
    });
    if (!clinic) throw new NotFoundException('کلینیک یافت نشد');
    return { ...DEFAULT_PANEL_NOTIFICATIONS, ...clinic.panelNotifications };
  }

  async updateNotifications(
    ctx: ClinicContext,
    dto: UpdatePanelNotificationsDto,
  ) {
    const current = await this.getNotifications(ctx);
    const changes = Object.fromEntries(
      Object.entries(dto).filter(([, value]) => value !== undefined),
    ) as Record<string, boolean>;
    const next = { ...current, ...changes };
    await this.clinicsRepository.update(ctx.clinicId, {
      panelNotifications: next,
    });
    return next;
  }
}
