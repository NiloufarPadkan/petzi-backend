import { ConflictException, HttpException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { DataSource } from 'typeorm';
import { ClinicLogType } from '../../common/enums/clinic-enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { normalizePhoneNumber } from '../../common/validators/is-iranian-phone.validator';
import { AuthService } from '../auth/auth.service';
import { ClinicLog } from '../clinics/entities/clinic-log.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  User,
} from '../users/entities/user.entity';
import { UsersService } from '../users/users.service';
import { ClinicTeamService } from './clinic-team.service';
import {
  ALL_CLINIC_PERMISSIONS,
  DEFAULT_PANEL_NOTIFICATIONS,
} from './clinic-panel.constants';
import type { ClinicContext } from './clinic-panel.guard';
import { RegisterClinicDto } from './dto/registration.dto';

@Injectable()
export class ClinicRegistrationService {
  constructor(
    private readonly dataSource: DataSource,
    private readonly authService: AuthService,
    private readonly usersService: UsersService,
    private readonly teamService: ClinicTeamService,
  ) {}

  /**
   * Self-service sign-up for a clinic manager. The clinic starts as
   * pending-approval and unlisted until an admin approves it.
   */
  async register(dto: RegisterClinicDto) {
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const email = dto.email.toLowerCase();

    if (await this.usersService.findByPhone(phoneNumber)) {
      throw new ConflictException('این شماره موبایل قبلاً ثبت شده است');
    }
    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است');
    }
    await this.authService.consumeRegistrationToken(
      dto.registrationToken,
      phoneNumber,
    );

    const password = await bcrypt.hash(dto.password, 12);
    let user: User;
    try {
      user = await this.dataSource.transaction(async (manager) => {
        const created = await manager.save(
          manager.create(User, {
            role: UserRole.CLINIC,
            fullName: dto.managerName,
            phoneNumber,
            email,
            password,
            isPhoneVerified: true,
            notificationPreferences: {
              ...DEFAULT_NOTIFICATION_PREFERENCES,
              newsletter: dto.newsletter ?? false,
            },
          }),
        );
        await manager.save(
          manager.create(Clinic, {
            userId: created.id,
            name: dto.name,
            type: dto.type,
            about: dto.about ?? null,
            licenseNumber: dto.licenseNumber,
            registrationNumber: dto.registrationNumber ?? null,
            phone: dto.phone,
            province: dto.province,
            city: dto.city,
            address: dto.address,
            isListedInSearch: false,
            panelNotifications: DEFAULT_PANEL_NOTIFICATIONS,
          }),
        );
        await manager.insert(ClinicLog, {
          clinicId: created.id,
          type: ClinicLogType.ACCOUNT_CREATED,
          reason: 'ثبت‌نام توسط مدیر کلینیک',
          actorId: created.id,
        });
        return created;
      });
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }

    await this.teamService.ensureDefaultRoles(user.id);
    const invitations = await this.sendInvites(user.id, dto);
    const auth = await this.authService.buildAuthResponse(
      user,
      'ثبت‌نام کلینیک با موفقیت انجام شد',
    );
    return { ...auth, invitations };
  }

  /** Invites are best-effort: a bad one is reported, not fatal. */
  private async sendInvites(clinicId: string, dto: RegisterClinicDto) {
    const ctx: ClinicContext = {
      clinicId,
      userId: clinicId,
      isManager: true,
      memberId: null,
      permissions: new Set(ALL_CLINIC_PERMISSIONS),
    };
    const results: {
      phoneNumber: string;
      status: 'sent' | 'failed';
      reason?: string;
    }[] = [];
    for (const invite of dto.invites ?? []) {
      try {
        await this.teamService.invite(ctx, invite);
        results.push({ phoneNumber: invite.phoneNumber, status: 'sent' });
      } catch (error) {
        if (!(error instanceof HttpException)) throw error;
        results.push({
          phoneNumber: invite.phoneNumber,
          status: 'failed',
          reason: error.message,
        });
      }
    }
    return results;
  }
}
