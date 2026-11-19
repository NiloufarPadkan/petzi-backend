import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, IsNull, Repository } from 'typeorm';
import { ReservationStatus } from '../../common/enums/admin-panel.enums';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { SubscriptionPlan } from '../../common/enums/subscription-plan.enum';
import { SubscriptionStatus } from '../../common/enums/subscription-status.enum';
import { VaccinationStatus } from '../../common/enums/vaccination-status.enum';
import { addDays, tehranToday } from '../../common/utils/tehran-time';
import { Notification } from '../notifications/entities/notification.entities';
import {
  PetMedication,
  PetWeight,
} from '../pet-health/entities/pet-health.entities';
import { PetHealthService } from '../pet-health/pet-health.service';
import { PetVaccine } from '../pets/entities/pet-vaccine.entity';
import { Pet } from '../pets/entities/pet.entity';
import { ProvidersService } from '../providers/providers.service';
import { Reservation } from '../reservations/entities/reservation.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';

const ACTIVE = [ReservationStatus.PENDING, ReservationStatus.CONFIRMED];
const VACCINE_LEAD_DAYS = 7;
const WEIGHT_STALE_DAYS = 30;

export type Severity = 'info' | 'warning' | 'urgent';

export interface AttentionItem {
  type: string;
  severity: Severity;
  title: string;
  petId: string | null;
  refId: string | null;
  dueAt: string | null;
}

/** Quick services shown on the home screen; only vets exist in the backend. */
const QUICK_SERVICES = [
  { key: 'vet', label: 'دامپزشک متخصص', available: true },
  { key: 'training', label: 'آموزش و تربیت سگ', available: false },
  { key: 'grooming', label: 'آرایشگاه و اصلاح پت', available: false },
  { key: 'petshop', label: 'پت‌شاپ آنلاین', available: false },
  { key: 'boarding', label: 'پانسیون شبانه‌روزی', available: false },
  { key: 'home_care', label: 'مراقبت اختصاصی در منزل', available: false },
];

const isMeaningful = (value: string | null | undefined): value is string =>
  !!value && !['none', 'ندارد', '-'].includes(value.trim().toLowerCase());

@Injectable()
export class HomeService {
  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(PetVaccine)
    private readonly vaccinesRepository: Repository<PetVaccine>,
    @InjectRepository(PetMedication)
    private readonly medicationsRepository: Repository<PetMedication>,
    @InjectRepository(PetWeight)
    private readonly weightsRepository: Repository<PetWeight>,
    @InjectRepository(Reservation)
    private readonly reservationsRepository: Repository<Reservation>,
    @InjectRepository(Subscription)
    private readonly subscriptionsRepository: Repository<Subscription>,
    @InjectRepository(Notification)
    private readonly notificationsRepository: Repository<Notification>,
    private readonly petHealthService: PetHealthService,
    private readonly providersService: ProvidersService,
  ) {}

  async getHome(userId: string, petId?: string) {
    const pets = await this.petsRepository.find({
      where: { ownerId: userId, status: PetStatus.ACTIVE },
      order: { createdAt: 'ASC' },
    });
    const unread = await this.notificationsRepository.count({
      where: { userId, readAt: IsNull() },
    });
    const isPremium = await this.isPremium(userId);

    const selected = petId ? pets.find((pet) => pet.id === petId) : pets[0];
    if (petId && !selected) throw new NotFoundException('حیوان خانگی یافت نشد');

    const petIds = pets.map((pet) => pet.id);
    const [needsAttention, upcoming] = await Promise.all([
      petIds.length ? this.needsAttention(pets, selected) : [],
      petIds.length ? this.upcomingReservations(userId) : [],
    ]);

    return {
      unreadNotifications: unread,
      pets: pets.map((pet) => ({ id: pet.id, name: pet.name, type: pet.type })),
      selectedPet: selected ? await this.petSummary(selected) : null,
      needsAttention,
      upcomingReservations: upcoming,
      medicalAlerts: selected ? await this.medicalAlerts(selected) : [],
      recentActivity: selected
        ? (
            await this.petHealthService.timeline(userId, selected.id, {
              limit: 5,
            })
          ).items
        : [],
      quickServices: QUICK_SERVICES,
      suggestions: selected
        ? await this.suggestions(selected, isPremium, upcoming.length)
        : [],
    };
  }

  /** Quick-action search across providers and the owner's own pets. */
  async search(userId: string, term: string, limit: number) {
    const q = term.trim();
    if (q.length < 2) return { vets: [], clinics: [], pets: [] };

    const [vets, clinics, pets] = await Promise.all([
      this.providersService.listVets(userId, {
        page: 1,
        limit,
        sort: 'rating',
        search: q,
      }),
      this.providersService.listClinics(userId, {
        page: 1,
        limit,
        sort: 'rating',
        search: q,
      }),
      this.petsRepository
        .createQueryBuilder('pet')
        .where('pet.ownerId = :userId AND pet.status = :active', {
          userId,
          active: PetStatus.ACTIVE,
        })
        .andWhere('pet.name ILIKE :q', { q: `%${q}%` })
        .limit(limit)
        .getMany(),
    ]);
    return {
      vets: vets.items,
      clinics: clinics.items,
      pets: pets.map((pet) => ({
        id: pet.id,
        name: pet.name,
        type: pet.type,
        breed: pet.breed,
      })),
    };
  }

  // ---- sections ----

  private async petSummary(pet: Pet) {
    const [lastWeight, lastVisit] = await Promise.all([
      this.weightsRepository.findOne({
        where: { petId: pet.id },
        order: { measuredAt: 'DESC', createdAt: 'DESC' },
      }),
      this.reservationsRepository.findOne({
        where: { petId: pet.id, status: ReservationStatus.COMPLETED },
        order: { scheduledAt: 'DESC' },
      }),
    ]);
    return {
      id: pet.id,
      name: pet.name,
      type: pet.type,
      breed: pet.breed,
      gender: pet.gender,
      age: this.age(pet.birthDate),
      approximateAge: pet.approximateAge,
      weight: lastWeight?.weightKg ?? pet.weight,
      lastWeightAt: lastWeight?.measuredAt ?? null,
      healthStatus: pet.healthStatus,
      vaccinationStatus: pet.vaccinationStatus,
      lastVisitAt: lastVisit?.scheduledAt ?? null,
    };
  }

  private async needsAttention(
    pets: Pet[],
    selected?: Pet,
  ): Promise<AttentionItem[]> {
    const petIds = pets.map((pet) => pet.id);
    const names = new Map(pets.map((pet) => [pet.id, pet.name ?? 'پت شما']));
    const today = tehranToday();
    const items: AttentionItem[] = [];

    const vaccines = await this.vaccinesRepository
      .createQueryBuilder('v')
      .where('v.petId IN (:...petIds)', { petIds })
      .andWhere('v.nextDueDate IS NOT NULL AND v.nextDueDate <= :until', {
        until: addDays(today, VACCINE_LEAD_DAYS),
      })
      .orderBy('v.nextDueDate', 'ASC')
      .limit(10)
      .getMany();
    for (const v of vaccines) {
      const overdue = v.nextDueDate! < today;
      items.push({
        type: 'vaccine',
        severity: overdue ? 'urgent' : 'warning',
        title: overdue
          ? `واکسن «${v.vaccineName}» ${names.get(v.petId)} عقب افتاده است`
          : `واکسن «${v.vaccineName}» ${names.get(v.petId)} به‌زودی موعد دارد`,
        petId: v.petId,
        refId: v.id,
        dueAt: v.nextDueDate,
      });
    }

    const medications = await this.medicationsRepository.find({
      where: { petId: In(petIds), isActive: true },
    });
    for (const m of medications) {
      if (m.endDate && m.endDate >= today && m.endDate <= addDays(today, 1)) {
        items.push({
          type: 'medication',
          severity: 'info',
          title: `مصرف «${m.name}» ${names.get(m.petId)} رو به پایان است`,
          petId: m.petId,
          refId: m.id,
          dueAt: m.endDate,
        });
      }
    }

    const pending = await this.reservationsRepository.find({
      where: { petId: In(petIds), status: ReservationStatus.PENDING },
      take: 5,
      order: { scheduledAt: 'ASC' },
    });
    for (const r of pending) {
      items.push({
        type: 'reservation_pending',
        severity: 'info',
        title: `نوبت «${r.serviceName}» در انتظار تایید کلینیک است`,
        petId: r.petId,
        refId: r.id,
        dueAt: r.scheduledAt.toISOString(),
      });
    }

    if (selected) {
      const weight = await this.weightsRepository.findOne({
        where: { petId: selected.id },
        order: { measuredAt: 'DESC' },
      });
      if (!weight || weight.measuredAt < addDays(today, -WEIGHT_STALE_DAYS)) {
        items.push({
          type: 'add_weight',
          severity: 'info',
          title: `وزن ${names.get(selected.id)} را ثبت کنید`,
          petId: selected.id,
          refId: null,
          dueAt: null,
        });
      }
    }

    const rank: Record<Severity, number> = { urgent: 0, warning: 1, info: 2 };
    return items.sort((a, b) => rank[a.severity] - rank[b.severity]);
  }

  private async upcomingReservations(userId: string) {
    const reservations = await this.reservationsRepository
      .createQueryBuilder('r')
      .leftJoinAndSelect('r.pet', 'pet')
      .leftJoinAndSelect('r.vet', 'vet')
      .where('r.ownerId = :userId', { userId })
      .andWhere('r.status IN (:...active) AND r.scheduledAt >= now()', {
        active: ACTIVE,
      })
      .orderBy('r.scheduledAt', 'ASC')
      .limit(3)
      .getMany();
    return reservations.map((r) => ({
      id: r.id,
      code: `BK-${r.number}`,
      status: r.status,
      serviceName: r.serviceName,
      scheduledAt: r.scheduledAt,
      pet: r.pet ? { id: r.pet.id, name: r.pet.name } : null,
      vet: r.vet ? { id: r.vet.id, fullName: r.vet.fullName } : null,
    }));
  }

  private async medicalAlerts(pet: Pet) {
    const alerts: { type: string; title: string; detail: string }[] = [];
    if (isMeaningful(pet.allergies)) {
      alerts.push({ type: 'allergy', title: 'آلرژی', detail: pet.allergies });
    }
    if (isMeaningful(pet.underlyingDiseases)) {
      alerts.push({
        type: 'condition',
        title: 'بیماری زمینه‌ای',
        detail: pet.underlyingDiseases,
      });
    }
    const medications = await this.medicationsRepository.find({
      where: { petId: pet.id, isActive: true },
    });
    for (const m of medications) {
      alerts.push({
        type: 'medication',
        title: 'داروی در حال مصرف',
        detail: [m.name, m.dosage, m.frequency].filter(Boolean).join(' - '),
      });
    }
    return alerts;
  }

  /** Plain rules, not AI: nudges derived from what the pet is missing. */
  private async suggestions(
    pet: Pet,
    isPremium: boolean,
    upcomingCount: number,
  ) {
    const suggestions: { type: string; title: string; petId: string | null }[] =
      [];
    const today = tehranToday();

    const lastVisit = await this.reservationsRepository.findOne({
      where: { petId: pet.id, status: ReservationStatus.COMPLETED },
      order: { scheduledAt: 'DESC' },
    });
    const yearAgo = new Date(`${addDays(today, -365)}T00:00:00+03:30`);
    if (
      (!lastVisit || lastVisit.scheduledAt < yearAgo) &&
      upcomingCount === 0
    ) {
      suggestions.push({
        type: 'book_checkup',
        title: `برای ${pet.name ?? 'پت شما'} نوبت چکاپ بگیرید`,
        petId: pet.id,
      });
    }
    if (
      pet.vaccinationStatus &&
      pet.vaccinationStatus !== VaccinationStatus.COMPLETE
    ) {
      suggestions.push({
        type: 'complete_vaccination',
        title: 'واکسیناسیون را کامل کنید',
        petId: pet.id,
      });
    }
    if (!isPremium) {
      suggestions.push({
        type: 'upgrade_premium',
        title: 'با اشتراک ویژه از امکانات بیشتر استفاده کنید',
        petId: null,
      });
    }
    return suggestions;
  }

  private async isPremium(userId: string): Promise<boolean> {
    const latest = await this.subscriptionsRepository.findOne({
      where: { userId },
      order: { createdAt: 'DESC' },
    });
    return (
      !!latest &&
      latest.status === SubscriptionStatus.ACTIVE &&
      latest.plan !== SubscriptionPlan.FREE &&
      (!latest.expiresAt || latest.expiresAt.getTime() > Date.now())
    );
  }

  private age(birthDate: string | null) {
    if (!birthDate) return null;
    const born = new Date(birthDate);
    const now = new Date();
    let months =
      (now.getFullYear() - born.getFullYear()) * 12 +
      (now.getMonth() - born.getMonth());
    if (now.getDate() < born.getDate()) months -= 1;
    months = Math.max(months, 0);
    return { years: Math.floor(months / 12), months: months % 12 };
  }
}
