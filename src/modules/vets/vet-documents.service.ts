import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import {
  RejectVetDocumentsDto,
  SetVetDocumentStatusDto,
  VetDocumentResponseDto,
} from './dto/vet-document.dto';
import { VetDocument } from './entities/vet-document.entity';
import { VetsService } from './vets.service';

@Injectable()
export class VetDocumentsService {
  private readonly logger = new Logger(VetDocumentsService.name);

  constructor(
    @InjectRepository(VetDocument)
    private readonly documentsRepository: Repository<VetDocument>,
    private readonly vetsService: VetsService,
    private readonly dataSource: DataSource,
  ) {}

  async findAll(vetId: string): Promise<VetDocumentResponseDto[]> {
    await this.vetsService.getVetOrThrow(vetId);
    const documents = await this.documentsRepository.find({
      where: { vetId },
      order: { createdAt: 'ASC' },
    });
    return documents.map((document) => this.toResponse(document));
  }

  async create(
    vetId: string,
    title: string,
    file: Express.Multer.File,
  ): Promise<VetDocumentResponseDto> {
    await this.vetsService.getVetOrThrow(vetId);
    const document = await this.documentsRepository.save(
      this.documentsRepository.create({
        vetId,
        title,
        originalName: file.originalname,
        fileUrl: `/uploads/vet-documents/${file.filename}`,
        mimeType: file.mimetype,
        sizeBytes: file.size,
      }),
    );
    return this.toResponse(document);
  }

  async getForDownload(vetId: string, documentId: string) {
    return this.getDocumentOrThrow(vetId, documentId);
  }

  async setStatus(
    vetId: string,
    documentId: string,
    dto: SetVetDocumentStatusDto,
  ): Promise<VetDocumentResponseDto> {
    const document = await this.getDocumentOrThrow(vetId, documentId);
    await this.documentsRepository.update(document.id, {
      status: dto.status,
      rejectionReason:
        dto.status === ApprovalStatus.REJECTED ? (dto.reason ?? null) : null,
    });
    return this.toResponse(await this.getDocumentOrThrow(vetId, documentId));
  }

  /** Approves every document and marks the vet as verified. */
  async approveAll(
    vetId: string,
    actorId: string,
  ): Promise<VetDocumentResponseDto[]> {
    const vet = await this.vetsService.getVetOrThrow(vetId);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        VetDocument,
        { vetId },
        { status: ApprovalStatus.APPROVED, rejectionReason: null },
      );
      await this.vetsService.changeStatus(
        vet.userId,
        { verificationStatus: ApprovalStatus.APPROVED },
        actorId,
        manager,
      );
    });
    return this.findAll(vetId);
  }

  /** Rejects every document and marks the vet as rejected with the message. */
  async rejectAll(
    vetId: string,
    dto: RejectVetDocumentsDto,
    actorId: string,
  ): Promise<VetDocumentResponseDto[]> {
    const vet = await this.vetsService.getVetOrThrow(vetId);
    await this.dataSource.transaction(async (manager) => {
      await manager.update(
        VetDocument,
        { vetId },
        { status: ApprovalStatus.REJECTED, rejectionReason: dto.message },
      );
      await this.vetsService.changeStatus(
        vet.userId,
        { verificationStatus: ApprovalStatus.REJECTED, reason: dto.message },
        actorId,
        manager,
      );
    });
    return this.findAll(vetId);
  }

  async remove(vetId: string, documentId: string): Promise<void> {
    const document = await this.getDocumentOrThrow(vetId, documentId);
    await this.documentsRepository.remove(document);
    try {
      await removeUploadUrls([document.fileUrl]);
    } catch (error) {
      this.logger.warn(
        `Document ${documentId} was deleted but its file could not be removed`,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  private async getDocumentOrThrow(
    vetId: string,
    documentId: string,
  ): Promise<VetDocument> {
    await this.vetsService.getVetOrThrow(vetId);
    const document = await this.documentsRepository.findOne({
      where: { id: documentId, vetId },
    });
    if (!document) {
      throw new NotFoundException('مدرک یافت نشد');
    }
    return document;
  }

  private toResponse(document: VetDocument): VetDocumentResponseDto {
    return {
      id: document.id,
      title: document.title,
      originalName: document.originalName,
      fileUrl: `/api/v1/admin/vets/${document.vetId}/documents/${document.id}/download`,
      mimeType: document.mimeType,
      sizeBytes: document.sizeBytes,
      status: document.status,
      rejectionReason: document.rejectionReason,
      createdAt: document.createdAt,
    };
  }
}
