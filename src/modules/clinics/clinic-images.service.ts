import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ClinicImageCategory } from '../../common/enums/clinic-enums';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { ClinicImageResponseDto } from './dto/clinic-response.dto';
import { UpdateClinicImageDto } from './dto/clinic-image.dto';
import { ClinicImage } from './entities/clinic-image.entity';
import { ClinicsService } from './clinics.service';

@Injectable()
export class ClinicImagesService {
  private readonly logger = new Logger(ClinicImagesService.name);

  constructor(
    @InjectRepository(ClinicImage)
    private readonly imagesRepository: Repository<ClinicImage>,
    private readonly clinicsService: ClinicsService,
  ) {}

  async findAll(
    clinicId: string,
    category?: ClinicImageCategory,
  ): Promise<ClinicImageResponseDto[]> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const images = await this.imagesRepository.find({
      where: { clinicId, ...(category ? { category } : {}) },
      order: { createdAt: 'DESC' },
    });
    return images.map((image) => this.toResponse(image));
  }

  async create(
    clinicId: string,
    title: string,
    category: ClinicImageCategory,
    fileUrl: string,
  ): Promise<ClinicImageResponseDto> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const image = await this.imagesRepository.save(
      this.imagesRepository.create({ clinicId, title, category, fileUrl }),
    );
    return this.toResponse(image);
  }

  async update(
    clinicId: string,
    imageId: string,
    dto: UpdateClinicImageDto,
  ): Promise<ClinicImageResponseDto> {
    const image = await this.getImageOrThrow(clinicId, imageId);
    if (Object.keys(dto).length > 0) {
      await this.imagesRepository.update(image.id, dto);
    }
    return this.toResponse(await this.getImageOrThrow(clinicId, imageId));
  }

  async remove(clinicId: string, imageId: string): Promise<void> {
    const image = await this.getImageOrThrow(clinicId, imageId);
    await this.imagesRepository.remove(image);
    try {
      await removeUploadUrls([image.fileUrl]);
    } catch (error) {
      this.logger.warn(
        `Image ${imageId} was deleted but its file could not be removed`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async getImageOrThrow(
    clinicId: string,
    imageId: string,
  ): Promise<ClinicImage> {
    await this.clinicsService.getClinicOrThrow(clinicId);
    const image = await this.imagesRepository.findOne({
      where: { id: imageId, clinicId },
    });
    if (!image) {
      throw new NotFoundException('تصویر یافت نشد');
    }
    return image;
  }

  private toResponse(image: ClinicImage): ClinicImageResponseDto {
    return {
      id: image.id,
      title: image.title,
      category: image.category,
      fileUrl: image.fileUrl,
      createdAt: image.createdAt,
    };
  }
}
