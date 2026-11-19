import {
  applyDecorators,
  createParamDecorator,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  SetMetadata,
  UseGuards,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { InjectRepository } from '@nestjs/typeorm';
import { ApiBearerAuth } from '@nestjs/swagger';
import type { Request } from 'express';
import { Repository } from 'typeorm';
import { ClinicActivityStatus } from '../../common/enums/clinic-enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { Clinic } from '../clinics/entities/clinic.entity';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { JwtPayload } from '../auth/interfaces/auth.interface';
import {
  ALL_CLINIC_PERMISSIONS,
  CLINIC_PANEL_PERMISSION_KEY,
  ClinicPermission,
} from './clinic-panel.constants';
import { ClinicMember } from './entities/clinic-member.entity';

/** Who is acting inside a clinic, resolved from the access token. */
export interface ClinicContext {
  clinicId: string;
  userId: string;
  /** The clinic's own (manager) account; holds every permission. */
  isManager: boolean;
  memberId: string | null;
  permissions: ReadonlySet<string>;
}

type PanelRequest = Request & {
  user: JwtPayload;
  clinicContext?: ClinicContext;
};

@Injectable()
export class ClinicPanelGuard {
  constructor(
    private readonly reflector: Reflector,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    @InjectRepository(ClinicMember)
    private readonly membersRepository: Repository<ClinicMember>,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<PanelRequest>();
    const { sub: userId, role } = request.user;

    let clinicId: string;
    let memberId: string | null = null;
    let permissions: ReadonlySet<string>;
    const isManager = role === UserRole.CLINIC;

    if (isManager) {
      clinicId = userId;
      permissions = new Set(ALL_CLINIC_PERMISSIONS);
    } else if (role === UserRole.VET || role === UserRole.CLINIC_STAFF) {
      const member = await this.membersRepository.findOne({
        where: { userId, isActive: true },
        relations: { role: true },
      });
      if (!member) throw new ForbiddenException('شما عضو هیچ کلینیکی نیستید');
      clinicId = member.clinicId;
      memberId = member.id;
      permissions = new Set(member.role?.permissions ?? []);
    } else {
      throw new ForbiddenException('دسترسی غیرمجاز');
    }

    const clinic = await this.clinicsRepository.findOne({
      where: { userId: clinicId },
      select: { userId: true, activityStatus: true },
    });
    if (!clinic) throw new ForbiddenException('کلینیک یافت نشد');
    if (clinic.activityStatus === ClinicActivityStatus.SUSPENDED) {
      throw new ForbiddenException('حساب کلینیک تعلیق شده است');
    }

    const required =
      this.reflector.getAllAndOverride<ClinicPermission[]>(
        CLINIC_PANEL_PERMISSION_KEY,
        [context.getHandler(), context.getClass()],
      ) ?? [];
    if (!required.every((permission) => permissions.has(permission))) {
      throw new ForbiddenException('دسترسی کافی برای این عملیات ندارید');
    }

    request.clinicContext = {
      clinicId,
      userId,
      isManager,
      memberId,
      permissions,
    };
    return true;
  }
}

/** JWT + clinic membership; optionally requires permissions on the route. */
export const ClinicPanel = (...permissions: ClinicPermission[]) =>
  applyDecorators(
    ApiBearerAuth('JWT'),
    UseGuards(JwtAuthGuard, ClinicPanelGuard),
    SetMetadata(CLINIC_PANEL_PERMISSION_KEY, permissions),
  );

/** Narrows an already-guarded class with a route-level permission. */
export const RequirePermission = (...permissions: ClinicPermission[]) =>
  SetMetadata(CLINIC_PANEL_PERMISSION_KEY, permissions);

export const CurrentClinic = createParamDecorator(
  (_data: unknown, context: ExecutionContext): ClinicContext => {
    const request = context.switchToHttp().getRequest<PanelRequest>();
    return request.clinicContext!;
  },
);
