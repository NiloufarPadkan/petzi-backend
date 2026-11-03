import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import {
  CreateVetClinicServiceDto,
  UpdateVetClinicServiceDto,
  VetClinicServiceResponseDto,
} from './dto/vet-clinic-service.dto';
import { VetClinicService } from './entities/vet-clinic-service.entity';
import { VetsService } from './vets.service';

@Injectable()
export class VetClinicServicesService {
  constructor(
    @InjectRepository(VetClinicService)
    private readonly servicesRepository: Repository<VetClinicService>,
    private readonly vetsService: VetsService,
  ) {}

  async findAll(vetId: string): Promise<VetClinicServiceResponseDto[]> {
    await this.vetsService.getVetOrThrow(vetId);
    const services = await this.servicesRepository.find({
      where: { vetId },
      order: { createdAt: 'ASC' },
    });
    return services.map((service) => this.toResponse(service));
  }

  async create(
    vetId: string,
    dto: CreateVetClinicServiceDto,
  ): Promise<VetClinicServiceResponseDto> {
    await this.vetsService.getVetOrThrow(vetId);
    const service = await this.servicesRepository.save(
      this.servicesRepository.create({ ...dto, vetId }),
    );
    return this.toResponse(service);
  }

  async update(
    vetId: string,
    serviceId: string,
    dto: UpdateVetClinicServiceDto,
  ): Promise<VetClinicServiceResponseDto> {
    const service = await this.getServiceOrThrow(vetId, serviceId);
    if (Object.keys(dto).length > 0) {
      await this.servicesRepository.update(service.id, dto);
    }
    return this.toResponse(await this.getServiceOrThrow(vetId, serviceId));
  }

  async remove(vetId: string, serviceId: string): Promise<void> {
    const service = await this.getServiceOrThrow(vetId, serviceId);
    await this.servicesRepository.remove(service);
  }

  private async getServiceOrThrow(
    vetId: string,
    serviceId: string,
  ): Promise<VetClinicService> {
    await this.vetsService.getVetOrThrow(vetId);
    const service = await this.servicesRepository.findOne({
      where: { id: serviceId, vetId },
    });
    if (!service) {
      throw new NotFoundException('خدمت یافت نشد');
    }
    return service;
  }

  private toResponse(service: VetClinicService): VetClinicServiceResponseDto {
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
