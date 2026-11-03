import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateVetClinicServiceDto,
  UpdateVetClinicServiceDto,
  VetClinicServiceResponseDto,
} from '../vets/dto/vet-clinic-service.dto';
import { ClinicServiceItem } from './entities/clinic-service-item.entity';
import { ClinicsService } from './clinics.service';

@Injectable()
export class ClinicServicesService {
  constructor(
    @InjectRepository(ClinicServiceItem)
    private readonly servicesRepository: Repository<ClinicServiceItem>,
    private readonly clinicsService: ClinicsService,
  ) {}

  async findAll(clinicId: string): Promise<VetClinicServiceResponseDto[]> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const services = await this.servicesRepository.find({
      where: { clinicId },
      order: { createdAt: 'ASC' },
    });
    return services.map((service) => this.toResponse(service));
  }

  async create(
    clinicId: string,
    dto: CreateVetClinicServiceDto,
  ): Promise<VetClinicServiceResponseDto> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const service = await this.servicesRepository.save(
      this.servicesRepository.create({ ...dto, clinicId }),
    );
    return this.toResponse(service);
  }

  async update(
    clinicId: string,
    serviceId: string,
    dto: UpdateVetClinicServiceDto,
  ): Promise<VetClinicServiceResponseDto> {
    const service = await this.getServiceOrThrow(clinicId, serviceId);
    if (Object.keys(dto).length > 0) {
      await this.servicesRepository.update(service.id, dto);
    }
    return this.toResponse(await this.getServiceOrThrow(clinicId, serviceId));
  }

  async remove(clinicId: string, serviceId: string): Promise<void> {
    const service = await this.getServiceOrThrow(clinicId, serviceId);
    await this.servicesRepository.remove(service);
  }

  private async getServiceOrThrow(
    clinicId: string,
    serviceId: string,
  ): Promise<ClinicServiceItem> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId, clinicId },
    });
    if (!service) {
      throw new NotFoundException('خدمت یافت نشد');
    }
    return service;
  }

  private toResponse(service: ClinicServiceItem): VetClinicServiceResponseDto {
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      basePrice: service.basePrice,
      durationMinutes: service.durationMinutes,
      isActive: service.isActive,
      description: service.description,
      createdAt: service.createdAt,
    };
  }
}
