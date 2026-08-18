import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { ApproximateAge } from '../../common/enums/approximate-age.enum';
import { PetType } from '../../common/enums/pet-type.enum';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { AddVaccineDto } from './dto/add-vaccine.dto';
import { UpdatePetDto, validateAgeFields } from './dto/update-pet.dto';
import { Pet } from './entities/pet.entity';
import { PetVaccine } from './entities/pet-vaccine.entity';
import { PetDocument } from './entities/pet-document.entity';

const APPROXIMATE_AGE_LABELS: Record<ApproximateAge, string> = {
  [ApproximateAge.LESS_THAN_6_MONTHS]: 'کمتر از ۶ ماه',
  [ApproximateAge.SIX_MONTHS_TO_1_YEAR]: '۶ ماه تا ۱ سال',
  [ApproximateAge.TWO_TO_4_YEARS]: '۲ تا ۴ سال',
  [ApproximateAge.FOUR_TO_6_YEARS]: '۴ تا ۶ سال',
  [ApproximateAge.ABOVE_7_YEARS]: 'بالای ۷ سال',
};

const PET_TYPE_LABELS: Record<PetType, string> = {
  [PetType.CAT]: 'گربه',
  [PetType.DOG]: 'سگ',
  [PetType.RABBIT]: 'خرگوش',
  [PetType.BIRD]: 'پرنده',
  [PetType.HAMSTER]: 'همستر',
  [PetType.SNAKE]: 'مار',
  [PetType.OTHER]: 'سایر',
};

@Injectable()
export class PetsService {
  private readonly logger = new Logger(PetsService.name);

  constructor(
    @InjectRepository(Pet)
    private readonly petsRepository: Repository<Pet>,
    @InjectRepository(PetVaccine)
    private readonly vaccinesRepository: Repository<PetVaccine>,
    @InjectRepository(PetDocument)
    private readonly documentsRepository: Repository<PetDocument>,
  ) {}

  async createDraft(ownerId: string, dto?: UpdatePetDto) {
    const pet = this.petsRepository.create({
      ownerId,
      status: PetStatus.DRAFT,
    });
    const saved = await this.petsRepository.save(pet);

    if (dto && Object.keys(dto).length > 0) {
      const result = await this.update(ownerId, saved.id, dto);
      return result.pet;
    }

    return this.formatPetResponse(saved);
  }

  async findAllByOwner(ownerId: string, status?: PetStatus) {
    const where: { ownerId: string; status?: PetStatus } = { ownerId };
    if (status) where.status = status;

    const pets = await this.petsRepository.find({
      where,
      relations: { vaccines: true, documents: true },
      order: { createdAt: 'DESC' },
    });

    return pets.map((pet) => this.formatPetResponse(pet));
  }

  async findOneByOwner(ownerId: string, petId: string) {
    const pet = await this.getOwnedPet(ownerId, petId, true);
    return this.formatPetResponse(pet);
  }

  async update(ownerId: string, petId: string, dto: UpdatePetDto) {
    const ageError = validateAgeFields(dto);
    if (ageError) throw new BadRequestException(ageError);
    if (Object.values(dto).some((value) => value === null)) {
      throw new BadRequestException(
        'برای حذف مقدار از null استفاده نکنید؛ مقدار معتبر ارسال کنید',
      );
    }
    if (dto.birthDate && this.isFutureDate(dto.birthDate)) {
      throw new BadRequestException('تاریخ تولد نمی‌تواند در آینده باشد');
    }
    if (dto.lastDewormingDate && this.isFutureDate(dto.lastDewormingDate)) {
      throw new BadRequestException(
        'تاریخ آخرین ضد انگل نمی‌تواند در آینده باشد',
      );
    }

    await this.getEditablePet(ownerId, petId);
    const changes: Partial<Pet> = {};

    if (dto.birthDate !== undefined) {
      changes.birthDate = dto.birthDate;
      changes.approximateAge = null;
    } else if (dto.approximateAge !== undefined) {
      changes.approximateAge = dto.approximateAge;
      changes.birthDate = null;
    }

    const scalarFields = [
      'name',
      'type',
      'breed',
      'gender',
      'color',
      'appearanceFeatures',
      'weight',
      'height',
      'healthStatus',
      'underlyingDiseases',
      'allergies',
      'medications',
      'healthNotes',
      'vaccinationStatus',
      'lastDewormingDate',
      'dewormingType',
      'foodType',
      'foodBrand',
      'mealsPerDay',
      'foodSensitivities',
      'surgeries',
      'previousDiseases',
      'hospitalizations',
      'additionalNotes',
    ] as const;

    for (const field of scalarFields) {
      const value = dto[field];
      if (value !== undefined) {
        Object.assign(changes, { [field]: value });
      }
    }

    if (Object.keys(changes).length === 0) {
      const unchanged = await this.getOwnedPet(ownerId, petId, true);
      return {
        message: 'تغییری برای ذخیره ارسال نشد',
        pet: this.formatPetResponse(unchanged),
      };
    }

    const result = await this.petsRepository.update(
      { id: petId, ownerId, status: PetStatus.DRAFT },
      changes,
    );
    if (result.affected !== 1) {
      await this.getEditablePet(ownerId, petId);
      throw new BadRequestException('اطلاعات حیوان خانگی به‌روزرسانی نشد');
    }
    const withRelations = await this.getOwnedPet(ownerId, petId, true);

    return {
      message: 'اطلاعات ذخیره شد',
      pet: this.formatPetResponse(withRelations),
    };
  }

  async addVaccine(ownerId: string, petId: string, dto: AddVaccineDto) {
    await this.getEditablePet(ownerId, petId);
    if (this.isFutureDate(dto.vaccineDate)) {
      throw new BadRequestException(
        'تاریخ تزریق واکسن نمی‌تواند در آینده باشد',
      );
    }
    const vaccine = this.vaccinesRepository.create({
      petId,
      vaccineName: dto.vaccineType,
      vaccineDate: dto.vaccineDate,
    });
    const saved = await this.vaccinesRepository.save(vaccine);
    return {
      message: 'واکسن اضافه شد',
      vaccine: {
        id: saved.id,
        vaccineName: saved.vaccineName,
        vaccineDate: saved.vaccineDate,
      },
    };
  }

  async addDocuments(
    ownerId: string,
    petId: string,
    files: Express.Multer.File[],
  ) {
    await this.getEditablePet(ownerId, petId);

    if (!files?.length) {
      throw new BadRequestException('حداقل یک فایل باید ارسال شود');
    }

    const documents = files.map((file) =>
      this.documentsRepository.create({
        petId,
        originalName: file.originalname,
        fileUrl: `/uploads/pet-documents/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
    );

    const saved = await this.documentsRepository.save(documents);
    return {
      message: 'فایل‌ها با موفقیت آپلود شدند',
      documents: saved.map((doc) => ({
        id: doc.id,
        originalName: doc.originalName,
        fileUrl: this.getDocumentDownloadUrl(doc),
        mimeType: doc.mimeType,
        sizeBytes: doc.sizeBytes,
      })),
    };
  }

  async getDocument(ownerId: string, petId: string, documentId: string) {
    await this.getOwnedPet(ownerId, petId);
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, petId },
    });

    if (!document) {
      throw new NotFoundException('فایل یافت نشد');
    }

    return document;
  }

  async submit(ownerId: string, petId: string) {
    const pet = await this.getOwnedPet(ownerId, petId, true);

    if (pet.status === PetStatus.ACTIVE) {
      throw new BadRequestException('این حیوان خانگی قبلاً ثبت شده است');
    }

    this.validateReadyForSubmit(pet);

    const result = await this.petsRepository
      .createQueryBuilder()
      .update(Pet)
      .set({ status: PetStatus.ACTIVE })
      .where('"id" = :petId', { petId })
      .andWhere('"ownerId" = :ownerId', { ownerId })
      .andWhere('"status" = :draft', { draft: PetStatus.DRAFT })
      .andWhere('"name" IS NOT NULL')
      .andWhere('"type" IS NOT NULL')
      .andWhere('"gender" IS NOT NULL')
      .andWhere('("birthDate" IS NOT NULL OR "approximateAge" IS NOT NULL)')
      .andWhere('"weight" IS NOT NULL')
      .andWhere('"height" IS NOT NULL')
      .andWhere('"healthStatus" IS NOT NULL')
      .andWhere('"vaccinationStatus" IS NOT NULL')
      .andWhere('"foodType" IS NOT NULL')
      .andWhere('"mealsPerDay" IS NOT NULL')
      .execute();

    if (result.affected !== 1) {
      const current = await this.getOwnedPet(ownerId, petId, true);
      if (current.status === PetStatus.ACTIVE) {
        throw new BadRequestException('این حیوان خانگی قبلاً ثبت شده است');
      }
      this.validateReadyForSubmit(current);
      throw new BadRequestException('ثبت حیوان خانگی انجام نشد');
    }
    const saved = await this.getOwnedPet(ownerId, petId, true);

    return {
      message: 'ثبت حیوان خانگی با موفقیت انجام شد',
      pet: this.formatPetResponse(saved),
    };
  }

  async deleteDraft(ownerId: string, petId: string) {
    const pet = await this.getOwnedPet(ownerId, petId, true);
    if (pet.status !== PetStatus.DRAFT) {
      throw new BadRequestException('فقط پیش‌نویس‌ها قابل حذف هستند');
    }
    await this.petsRepository.remove(pet);
    try {
      await removeUploadUrls(
        pet.documents?.map((document) => document.fileUrl) ?? [],
      );
    } catch (error) {
      this.logger.warn(
        `Draft ${petId} was deleted but one or more files could not be removed`,
        error instanceof Error ? error.stack : undefined,
      );
    }
    return { message: 'پیش‌نویس حذف شد' };
  }

  private async getOwnedPet(
    ownerId: string,
    petId: string,
    withRelations = false,
  ): Promise<Pet> {
    const pet = await this.petsRepository.findOne({
      where: { id: petId, ownerId },
      relations: withRelations
        ? { vaccines: true, documents: true }
        : undefined,
    });

    if (!pet) {
      throw new NotFoundException('حیوان خانگی یافت نشد');
    }
    return pet;
  }

  private async getEditablePet(ownerId: string, petId: string): Promise<Pet> {
    const pet = await this.getOwnedPet(ownerId, petId);
    if (pet.status !== PetStatus.DRAFT) {
      throw new BadRequestException(
        'فقط حیوانات خانگی در وضعیت پیش‌نویس قابل ویرایش هستند',
      );
    }
    return pet;
  }

  private validateReadyForSubmit(pet: Pet) {
    const missing: string[] = [];

    if (!pet.name) missing.push('name');
    if (!pet.type) missing.push('type');
    if (!pet.gender) missing.push('gender');
    if (!pet.birthDate && !pet.approximateAge) {
      missing.push('birthDate or approximateAge');
    }
    if (pet.weight == null) missing.push('weight');
    if (pet.height == null) missing.push('height');
    if (!pet.healthStatus) missing.push('healthStatus');
    if (!pet.vaccinationStatus) missing.push('vaccinationStatus');
    if (!pet.foodType) missing.push('foodType');
    if (!pet.mealsPerDay) missing.push('mealsPerDay');

    if (missing.length) {
      throw new BadRequestException(
        `فرم کامل نیست. فیلدهای ناقص: ${missing.join(', ')}`,
      );
    }
  }

  private formatPetResponse(pet: Pet) {
    return {
      id: pet.id,
      status: pet.status,
      name: pet.name,
      type: pet.type,
      typeLabel: pet.type ? PET_TYPE_LABELS[pet.type] : null,
      breed: pet.breed,
      gender: pet.gender,
      birthDate: pet.birthDate,
      approximateAge: pet.approximateAge,
      ageLabel: this.getAgeLabel(pet),
      color: pet.color,
      appearanceFeatures: pet.appearanceFeatures,
      weight: pet.weight,
      height: pet.height,
      healthStatus: pet.healthStatus,
      underlyingDiseases: pet.underlyingDiseases,
      allergies: pet.allergies,
      medications: pet.medications,
      healthNotes: pet.healthNotes,
      vaccinationStatus: pet.vaccinationStatus,
      lastDewormingDate: pet.lastDewormingDate,
      dewormingType: pet.dewormingType,
      vaccines: pet.vaccines?.map((v) => ({
        id: v.id,
        vaccineName: v.vaccineName,
        vaccineDate: v.vaccineDate,
      })),
      foodType: pet.foodType,
      foodBrand: pet.foodBrand,
      mealsPerDay: pet.mealsPerDay,
      foodSensitivities: pet.foodSensitivities,
      surgeries: pet.surgeries,
      previousDiseases: pet.previousDiseases,
      hospitalizations: pet.hospitalizations,
      additionalNotes: pet.additionalNotes,
      documents: pet.documents?.map((d) => ({
        id: d.id,
        originalName: d.originalName,
        fileUrl: this.getDocumentDownloadUrl(d),
        mimeType: d.mimeType,
        sizeBytes: d.sizeBytes,
      })),
      createdAt: pet.createdAt,
      updatedAt: pet.updatedAt,
    };
  }

  private getAgeLabel(pet: Pet): string | null {
    if (pet.birthDate) {
      const birth = new Date(pet.birthDate);
      const now = new Date();
      const months =
        (now.getFullYear() - birth.getFullYear()) * 12 +
        (now.getMonth() - birth.getMonth());
      if (months < 12) return `${Math.max(0, months)} ماه`;
      const years = Math.floor(months / 12);
      return `${years} سال`;
    }
    if (pet.approximateAge) {
      return APPROXIMATE_AGE_LABELS[pet.approximateAge];
    }
    return null;
  }

  private isFutureDate(value: string): boolean {
    const date = new Date(`${value}T00:00:00.000Z`);
    const today = new Date();
    today.setUTCHours(0, 0, 0, 0);
    return date > today;
  }

  private getDocumentDownloadUrl(document: PetDocument): string {
    return `/api/v1/pets/${document.petId}/documents/${document.id}/download`;
  }
}
