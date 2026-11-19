import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { PaymentStatus } from '../../common/enums/admin-panel.enums';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { isUniqueViolation } from '../../common/utils/db-errors';
import { normalizePhoneNumber } from '../../common/validators/is-iranian-phone.validator';
import { ClinicServiceItem } from '../clinics/entities/clinic-service-item.entity';
import { Clinic } from '../clinics/entities/clinic.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Reservation } from '../reservations/entities/reservation.entity';
import {
  DEFAULT_NOTIFICATION_PREFERENCES,
  User,
} from '../users/entities/user.entity';
import { VetProfile } from '../vets/entities/vet-profile.entity';
import { VetReview } from '../vets/entities/vet-review.entity';
import {
  ALL_CLINIC_PERMISSIONS,
  ClinicMemberType,
  DEFAULT_ROLES,
  PERMISSION_GROUPS,
} from './clinic-panel.constants';
import type { ClinicContext } from './clinic-panel.guard';
import {
  AddExistingMemberDto,
  CreateRoleDto,
  InviteMemberDto,
  UpdateMemberDto,
  UpdateRoleDto,
} from './dto/team.dto';
import { ClinicMember } from './entities/clinic-member.entity';
import { ClinicRole } from './entities/clinic-role.entity';

const DAY_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class ClinicTeamService {
  constructor(
    @InjectRepository(ClinicMember)
    private readonly membersRepository: Repository<ClinicMember>,
    @InjectRepository(ClinicRole)
    private readonly rolesRepository: Repository<ClinicRole>,
    @InjectRepository(Clinic)
    private readonly clinicsRepository: Repository<Clinic>,
    @InjectRepository(ClinicServiceItem)
    private readonly servicesRepository: Repository<ClinicServiceItem>,
    @InjectRepository(VetProfile)
    private readonly vetsRepository: Repository<VetProfile>,
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  // ---- members ----

  async listMembers(ctx: ClinicContext) {
    const [clinic, members] = await Promise.all([
      this.getClinic(ctx.clinicId),
      this.membersRepository.find({
        where: { clinicId: ctx.clinicId },
        relations: { user: true, role: true },
        order: { joinedAt: 'ASC' },
      }),
    ]);
    const manager = await this.usersRepository.findOneByOrFail({
      id: ctx.clinicId,
    });
    return {
      total: members.length + 1,
      items: [
        {
          id: null,
          isManager: true,
          user: this.personView(manager),
          memberType: 'manager',
          jobTitle: 'مدیر کلینیک',
          role: null,
          isActive: true,
          status: 'active',
          joinedAt: clinic.createdAt,
        },
        ...members.map((member) => this.toListItem(member)),
      ],
    };
  }

  async getMember(ctx: ClinicContext, memberId: string) {
    const member = await this.getMemberOrThrow(ctx.clinicId, memberId);
    const userId = member.userId;
    const since = new Date(Date.now() - 30 * DAY_MS);

    const [
      vetProfile,
      services,
      rating,
      performance,
      lastReservations,
      reviews,
    ] = await Promise.all([
      this.vetsRepository.findOne({ where: { userId } }),
      member.serviceIds.length
        ? this.servicesRepository.find({
            where: { id: In(member.serviceIds), clinicId: ctx.clinicId },
          })
        : [],
      this.dataSource
        .getRepository(VetReview)
        .createQueryBuilder('v')
        .select('COALESCE(AVG(v.rating), 0)', 'average')
        .addSelect('COUNT(*)', 'count')
        .where('v.vetId = :userId AND v.status = :status', {
          userId,
          status: ApprovalStatus.APPROVED,
        })
        .getRawOne<{ average: string; count: string }>(),
      this.getPerformance(ctx.clinicId, userId, since),
      this.dataSource.getRepository(Reservation).find({
        where: { clinicId: ctx.clinicId, vetId: userId },
        relations: { pet: true },
        order: { scheduledAt: 'DESC' },
        take: 20,
      }),
      this.dataSource.getRepository(VetReview).find({
        where: { vetId: userId, status: ApprovalStatus.APPROVED },
        relations: { author: true },
        order: { createdAt: 'DESC' },
        take: 5,
      }),
    ]);

    const seen = new Set<string>();
    const recentPatients: {
      id: string;
      name: string | null;
      lastVisitAt: Date;
    }[] = [];
    for (const reservation of lastReservations) {
      if (!reservation.pet || seen.has(reservation.pet.id)) continue;
      seen.add(reservation.pet.id);
      recentPatients.push({
        id: reservation.pet.id,
        name: reservation.pet.name,
        lastVisitAt: reservation.scheduledAt,
      });
      if (recentPatients.length === 5) break;
    }

    return {
      ...this.toListItem(member),
      email: member.user.email,
      medicalCouncilNumber: vetProfile?.medicalCouncilNumber ?? null,
      primarySpecialty: vetProfile?.primarySpecialty ?? null,
      permissions: member.role?.permissions ?? [],
      workingHours: member.workingHours,
      services: services.map((service) => ({
        id: service.id,
        name: service.name,
        basePrice: service.basePrice,
      })),
      rating: {
        average: Math.round(Number(rating?.average ?? 0) * 10) / 10,
        count: Number(rating?.count ?? 0),
      },
      performanceLast30Days: performance,
      recentPatients,
      reviews: reviews.map((review) => ({
        id: review.id,
        rating: review.rating,
        comment: review.comment,
        author: review.author?.fullName ?? null,
        createdAt: review.createdAt,
      })),
    };
  }

  async invite(ctx: ClinicContext, dto: InviteMemberDto) {
    const clinic = await this.getClinic(ctx.clinicId);
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const email = dto.email?.toLowerCase();
    const role = dto.roleId
      ? await this.getRoleOrThrow(ctx.clinicId, dto.roleId)
      : await this.defaultRoleFor(ctx.clinicId, dto.memberType);
    if (role) this.assertCanGrant(ctx, role.permissions);

    const isVet = dto.memberType === ClinicMemberType.VET;
    if (isVet && !dto.medicalCouncilNumber) {
      throw new BadRequestException('کد نظام دامپزشکی الزامی است');
    }
    await this.assertUnique(phoneNumber, email);

    try {
      const memberId = await this.dataSource.transaction(async (manager) => {
        const user = await manager.save(
          manager.create(User, {
            role: isVet ? UserRole.VET : UserRole.CLINIC_STAFF,
            fullName: dto.fullName,
            phoneNumber,
            email,
            notificationPreferences: DEFAULT_NOTIFICATION_PREFERENCES,
          }),
        );
        if (isVet) {
          await manager.save(
            manager.create(VetProfile, {
              userId: user.id,
              medicalCouncilNumber: dto.medicalCouncilNumber,
              city: clinic.city,
              primarySpecialty: dto.primarySpecialty ?? 'عمومی',
              clinicId: clinic.userId,
              clinicName: clinic.name,
            }),
          );
        }
        const member = await manager.save(
          manager.create(ClinicMember, {
            clinicId: ctx.clinicId,
            userId: user.id,
            roleId: role?.id ?? null,
            memberType: dto.memberType,
            jobTitle: dto.jobTitle ?? null,
          }),
        );
        return member.id;
      });
      return await this.getMember(ctx, memberId);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException(
          'شماره موبایل، ایمیل یا کد نظام قبلاً ثبت شده است',
        );
      }
      throw error;
    }
  }

  async addExisting(ctx: ClinicContext, dto: AddExistingMemberDto) {
    const clinic = await this.getClinic(ctx.clinicId);
    const phoneNumber = normalizePhoneNumber(dto.phoneNumber);
    const user = await this.usersRepository.findOne({ where: { phoneNumber } });
    if (!user || user.role !== UserRole.VET) {
      throw new NotFoundException('دامپزشکی با این شماره موبایل یافت نشد');
    }
    if (await this.membersRepository.exists({ where: { userId: user.id } })) {
      throw new ConflictException('این دامپزشک عضو یک کلینیک است');
    }
    const role = dto.roleId
      ? await this.getRoleOrThrow(ctx.clinicId, dto.roleId)
      : await this.defaultRoleFor(ctx.clinicId, ClinicMemberType.VET);
    if (role) this.assertCanGrant(ctx, role.permissions);

    const member = await this.dataSource.transaction(async (manager) => {
      await manager.update(
        VetProfile,
        { userId: user.id },
        { clinicId: clinic.userId, clinicName: clinic.name },
      );
      return manager.save(
        manager.create(ClinicMember, {
          clinicId: ctx.clinicId,
          userId: user.id,
          roleId: role?.id ?? null,
          memberType: ClinicMemberType.VET,
          jobTitle: dto.jobTitle ?? null,
        }),
      );
    });
    return this.getMember(ctx, member.id);
  }

  async updateMember(
    ctx: ClinicContext,
    memberId: string,
    dto: UpdateMemberDto,
  ) {
    const member = await this.getMemberOrThrow(ctx.clinicId, memberId);

    if (dto.roleId !== undefined) {
      if (dto.roleId === null) {
        member.roleId = null;
      } else {
        const role = await this.getRoleOrThrow(ctx.clinicId, dto.roleId);
        this.assertCanGrant(ctx, role.permissions);
        member.roleId = role.id;
      }
    }
    if (dto.jobTitle !== undefined) member.jobTitle = dto.jobTitle;
    if (dto.isActive !== undefined) member.isActive = dto.isActive;
    if (dto.workingHours !== undefined) {
      for (const day of dto.workingHours) {
        if (!day.isClosed) {
          for (const shift of day.shifts) {
            if (shift.start >= shift.end) {
              throw new BadRequestException(
                'ساعت شروع باید قبل از ساعت پایان باشد',
              );
            }
          }
        }
      }
      member.workingHours = dto.workingHours;
    }
    if (dto.serviceIds !== undefined) {
      const count = dto.serviceIds.length
        ? await this.servicesRepository.count({
            where: { id: In(dto.serviceIds), clinicId: ctx.clinicId },
          })
        : 0;
      if (count !== dto.serviceIds.length) {
        throw new BadRequestException(
          'برخی از خدمات انتخاب‌شده متعلق به این کلینیک نیستند',
        );
      }
      member.serviceIds = dto.serviceIds;
    }

    // Write only the editable columns, not the loaded relations.
    await this.membersRepository.update(member.id, {
      roleId: member.roleId,
      jobTitle: member.jobTitle,
      isActive: member.isActive,
      workingHours: member.workingHours,
      serviceIds: member.serviceIds,
    });
    return this.getMember(ctx, memberId);
  }

  async removeMember(ctx: ClinicContext, memberId: string): Promise<void> {
    const member = await this.getMemberOrThrow(ctx.clinicId, memberId);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(ClinicMember, { id: member.id });
      await manager.update(
        VetProfile,
        { userId: member.userId, clinicId: ctx.clinicId },
        { clinicId: null },
      );
    });
  }

  // ---- roles ----

  permissionCatalog() {
    return { groups: PERMISSION_GROUPS };
  }

  /** Creates the starter roles once, the first time a clinic needs them. */
  async ensureDefaultRoles(clinicId: string): Promise<ClinicRole[]> {
    const existing = await this.rolesRepository.find({ where: { clinicId } });
    if (existing.length > 0) return existing;
    await this.rolesRepository
      .createQueryBuilder()
      .insert()
      .values(
        DEFAULT_ROLES.map((role) => ({
          clinicId,
          name: role.name,
          color: role.color,
          permissions: role.permissions,
        })),
      )
      .orIgnore()
      .execute();
    return this.rolesRepository.find({ where: { clinicId } });
  }

  /** The starter role that fits a member type, if the clinic still has it. */
  private async defaultRoleFor(
    clinicId: string,
    memberType: ClinicMemberType,
  ): Promise<ClinicRole | null> {
    const roles = await this.ensureDefaultRoles(clinicId);
    const preset = DEFAULT_ROLES.find((role) =>
      role.memberTypes.includes(memberType),
    );
    return roles.find((role) => role.name === preset?.name) ?? null;
  }

  async listRoles(ctx: ClinicContext) {
    await this.ensureDefaultRoles(ctx.clinicId);
    const roles = await this.rolesRepository.find({
      where: { clinicId: ctx.clinicId },
      order: { createdAt: 'ASC' },
    });
    const counts = await this.membersRepository
      .createQueryBuilder('m')
      .select('m.roleId', 'roleId')
      .addSelect('COUNT(*)', 'count')
      .where('m.clinicId = :clinicId AND m.roleId IS NOT NULL', {
        clinicId: ctx.clinicId,
      })
      .groupBy('m.roleId')
      .getRawMany<{ roleId: string; count: string }>();
    const byRole = new Map(
      counts.map((row) => [row.roleId, Number(row.count)]),
    );
    return roles.map((role) => ({
      ...this.toRoleView(role),
      memberCount: byRole.get(role.id) ?? 0,
    }));
  }

  async getRole(ctx: ClinicContext, roleId: string) {
    const role = await this.getRoleOrThrow(ctx.clinicId, roleId);
    const members = await this.membersRepository.find({
      where: { clinicId: ctx.clinicId, roleId },
      relations: { user: true, role: true },
    });
    const candidates = await this.membersRepository.find({
      where: { clinicId: ctx.clinicId },
      relations: { user: true },
    });
    return {
      ...this.toRoleView(role),
      members: members.map((member) => this.toListItem(member)),
      otherMembers: candidates
        .filter((member) => member.roleId !== roleId)
        .map((member) => ({
          id: member.id,
          user: this.personView(member.user),
          memberType: member.memberType,
        })),
    };
  }

  async createRole(ctx: ClinicContext, dto: CreateRoleDto) {
    this.assertCanGrant(ctx, dto.permissions);
    try {
      const role = await this.rolesRepository.save(
        this.rolesRepository.create({
          clinicId: ctx.clinicId,
          name: dto.name,
          color: dto.color ?? null,
          permissions: dto.permissions,
        }),
      );
      return this.toRoleView(role);
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('نقشی با این نام وجود دارد');
      }
      throw error;
    }
  }

  async updateRole(ctx: ClinicContext, roleId: string, dto: UpdateRoleDto) {
    const role = await this.getRoleOrThrow(ctx.clinicId, roleId);
    if (dto.permissions) {
      this.assertCanGrant(ctx, dto.permissions);
      // Non-managers must not strip a role they themselves hold... or
      // downgrade others' access beyond what they could grant.
      this.assertCanGrant(ctx, role.permissions);
      role.permissions = dto.permissions;
    }
    if (dto.name !== undefined) role.name = dto.name;
    if (dto.color !== undefined) role.color = dto.color;
    try {
      return this.toRoleView(await this.rolesRepository.save(role));
    } catch (error) {
      if (isUniqueViolation(error)) {
        throw new ConflictException('نقشی با این نام وجود دارد');
      }
      throw error;
    }
  }

  /** Members of a deleted role are left without a role (no permissions). */
  async deleteRole(ctx: ClinicContext, roleId: string): Promise<void> {
    const role = await this.getRoleOrThrow(ctx.clinicId, roleId);
    this.assertCanGrant(ctx, role.permissions);
    await this.rolesRepository.remove(role);
  }

  async assignRoleMember(ctx: ClinicContext, roleId: string, memberId: string) {
    const role = await this.getRoleOrThrow(ctx.clinicId, roleId);
    this.assertCanGrant(ctx, role.permissions);
    const member = await this.getMemberOrThrow(ctx.clinicId, memberId);
    await this.membersRepository.update(member.id, { roleId });
    return this.getRole(ctx, roleId);
  }

  async unassignRoleMember(
    ctx: ClinicContext,
    roleId: string,
    memberId: string,
  ) {
    const role = await this.getRoleOrThrow(ctx.clinicId, roleId);
    this.assertCanGrant(ctx, role.permissions);
    const member = await this.getMemberOrThrow(ctx.clinicId, memberId);
    if (member.roleId === roleId) {
      await this.membersRepository.update(member.id, { roleId: null });
    }
    return this.getRole(ctx, roleId);
  }

  // ---- helpers ----

  /** Staff can only hand out permissions they hold themselves. */
  private assertCanGrant(ctx: ClinicContext, permissions: readonly string[]) {
    if (ctx.isManager) return;
    const known = new Set<string>(ALL_CLINIC_PERMISSIONS);
    for (const permission of permissions) {
      if (!known.has(permission) || !ctx.permissions.has(permission)) {
        throw new ForbiddenException(
          'نمی‌توانید دسترسی‌ای را بدهید که خودتان ندارید',
        );
      }
    }
  }

  private async getClinic(clinicId: string): Promise<Clinic> {
    const clinic = await this.clinicsRepository.findOne({
      where: { userId: clinicId },
    });
    if (!clinic) throw new NotFoundException('کلینیک یافت نشد');
    return clinic;
  }

  private async getMemberOrThrow(clinicId: string, memberId: string) {
    const member = await this.membersRepository.findOne({
      where: { id: memberId, clinicId },
      relations: { user: true, role: true },
    });
    if (!member) throw new NotFoundException('عضو یافت نشد');
    return member;
  }

  private async getRoleOrThrow(clinicId: string, roleId: string) {
    const role = await this.rolesRepository.findOne({
      where: { id: roleId, clinicId },
    });
    if (!role) throw new NotFoundException('نقش یافت نشد');
    return role;
  }

  private async assertUnique(phoneNumber: string, email?: string) {
    if (
      await this.usersRepository.exists({
        where: { phoneNumber },
        withDeleted: true,
      })
    ) {
      throw new ConflictException('این شماره موبایل قبلاً ثبت شده است');
    }
    if (
      email &&
      (await this.usersRepository.exists({
        where: { email },
        withDeleted: true,
      }))
    ) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است');
    }
  }

  private async getPerformance(clinicId: string, vetId: string, since: Date) {
    const completed = await this.dataSource
      .getRepository(Reservation)
      .createQueryBuilder('r')
      .where('r.clinicId = :clinicId AND r.vetId = :vetId', { clinicId, vetId })
      .andWhere('r.status = :status', { status: ReservationStatus.COMPLETED })
      .andWhere('r.scheduledAt >= :since', { since })
      .getCount();
    const revenue = await this.dataSource
      .getRepository(Payment)
      .createQueryBuilder('p')
      .innerJoin('p.reservation', 'r')
      .select('COALESCE(SUM(p.finalAmount - p.refundedAmount), 0)', 'sum')
      .where('r.clinicId = :clinicId AND r.vetId = :vetId', { clinicId, vetId })
      .andWhere('p.status IN (:...statuses)', {
        statuses: [PaymentStatus.SUCCESS, PaymentStatus.REFUNDED],
      })
      .andWhere('p.paidAt >= :since', { since })
      .getRawOne<{ sum: string }>();
    return {
      completedReservations: completed,
      revenue: Number(revenue?.sum ?? 0),
    };
  }

  private personView(user: User) {
    return {
      id: user.id,
      fullName: user.fullName,
      phoneNumber: user.phoneNumber,
      profilePictureUrl: user.profilePictureUrl,
    };
  }

  private toListItem(member: ClinicMember) {
    return {
      id: member.id,
      isManager: false,
      user: this.personView(member.user),
      memberType: member.memberType,
      jobTitle: member.jobTitle,
      role: member.role ? this.toRoleView(member.role) : null,
      isActive: member.isActive,
      // Invited accounts show as pending until the person signs in once.
      status: !member.isActive
        ? 'inactive'
        : member.user.lastLoginAt
          ? 'active'
          : 'invited',
      joinedAt: member.joinedAt,
    };
  }

  private toRoleView(role: ClinicRole) {
    return {
      id: role.id,
      name: role.name,
      color: role.color,
      permissions: role.permissions,
    };
  }
}
