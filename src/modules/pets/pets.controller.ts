import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { diskStorage } from 'multer';
import { mkdirSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { fileHasExpectedSignature } from '../../common/utils/file-signature';
import { imageUploadOptions, saveImage } from '../../common/utils/image-upload';
import {
  removeUploadedFiles,
  removeUploadUrls,
} from '../../common/utils/upload-cleanup';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { AddVaccineDto } from './dto/add-vaccine.dto';
import { CreatePetDto, UpdatePetDto } from './dto/update-pet.dto';
import {
  PetDeleteResponseDto,
  PetDocumentsUploadResponseDto,
  PetResponseDto,
  PetSubmitResponseDto,
  PetUpdateResponseDto,
  PetVaccineCreateResponseDto,
} from './dto/pet-response.dto';
import { PetsService } from './pets.service';

const PET_PHOTO_DIRECTORY = 'pet-photos';
const PHOTO_MAX_BYTES = 5 * 1024 * 1024;

const documentUploadDirectory = join(process.cwd(), 'uploads', 'pet-documents');
mkdirSync(documentUploadDirectory, { recursive: true });

const documentStorage = diskStorage({
  destination: documentUploadDirectory,
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${DOCUMENT_MIME_EXTENSIONS[file.mimetype]}`);
  },
});

const DOCUMENT_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/gif': '.gif',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

@ApiTags('Pets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('pets')
export class PetsController {
  constructor(private readonly petsService: PetsService) {}

  @Post()
  @ApiOperation({
    summary: 'Create a pet draft',
    description:
      'Creates an empty draft pet. Optionally send initial fields in the body — same schema as PATCH /pets/{id}.',
  })
  @ApiBody({
    type: CreatePetDto,
    required: false,
    description: 'Optional initial pet data',
    examples: {
      empty: { summary: 'Empty draft', value: {} },
      withBasicInfo: {
        summary: 'Draft with basic info',
        value: { name: 'پشمک', type: 'cat', breed: 'Persian' },
      },
    },
  })
  @ApiCreatedResponse({ type: PetResponseDto })
  createDraft(@Req() req: AuthenticatedRequest, @Body() dto?: CreatePetDto) {
    return this.petsService.createDraft(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'List pets for the current user' })
  @ApiQuery({
    name: 'status',
    enum: PetStatus,
    required: false,
    description: 'Filter by draft or active',
  })
  @ApiOkResponse({ type: [PetResponseDto] })
  findAll(
    @Req() req: AuthenticatedRequest,
    @Query('status', new ParseEnumPipe(PetStatus, { optional: true }))
    status?: PetStatus,
  ) {
    return this.petsService.findAllByOwner(req.user.sub, status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get pet by ID (draft or active)' })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetResponseDto })
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petsService.findOneByOwner(req.user.sub, id);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update a pet (partial)',
    description:
      'Send any subset of pet fields. Works for drafts, where data accumulates until submit, and for registered pets. All fields are optional.',
  })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiBody({
    type: UpdatePetDto,
    examples: {
      basicInfo: {
        summary: 'Basic info',
        value: { name: 'پشمک', type: 'cat', breed: 'Persian' },
      },
      physical: {
        summary: 'Physical characteristics',
        value: {
          gender: 'female',
          birthDate: '2022-03-21',
          color: 'white',
          weight: 8.4,
          height: 45,
        },
      },
      health: {
        summary: 'Health & nutrition',
        value: {
          healthStatus: 'good',
          vaccinationStatus: 'complete',
          foodType: 'dry',
          mealsPerDay: '2',
        },
      },
      fullExample: {
        summary: 'Full pet data (can also be sent at once)',
        value: {
          name: 'پشمک',
          type: 'cat',
          breed: 'Persian',
          gender: 'female',
          birthDate: '2022-03-21',
          color: 'white',
          weight: 8.4,
          height: 45,
          healthStatus: 'good',
          underlyingDiseases: 'None',
          allergies: 'None',
          medications: 'None',
          vaccinationStatus: 'complete',
          foodType: 'dry',
          foodBrand: 'Royal Canin',
          mealsPerDay: '2',
          foodSensitivities: 'None',
          surgeries: 'None',
          previousDiseases: 'None',
          hospitalizations: 'None',
        },
      },
    },
  })
  @ApiOkResponse({ type: PetUpdateResponseDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.update(req.user.sub, id, dto, {
      allowActive: true,
    });
  }

  @Post(':id/vaccines')
  @ApiOperation({
    summary: 'Add a vaccine record',
    description:
      'Add one vaccine entry. Call multiple times for multiple vaccines.',
  })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiBody({ type: AddVaccineDto })
  @ApiCreatedResponse({ type: PetVaccineCreateResponseDto })
  addVaccine(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AddVaccineDto,
  ) {
    return this.petsService.addVaccine(req.user.sub, id, dto);
  }

  @Post(':id/documents')
  @ApiOperation({
    summary: 'Upload pet documents',
    description:
      'Upload up to 10 files (PNG, JPG, GIF, WEBP, PDF). Max 10MB each.',
  })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['documents'],
      properties: {
        documents: {
          type: 'array',
          items: { type: 'string', format: 'binary' },
          description: 'Pet document files',
        },
      },
    },
  })
  @ApiCreatedResponse({ type: PetDocumentsUploadResponseDto })
  @UseInterceptors(
    FilesInterceptor('documents', 10, {
      storage: documentStorage,
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!DOCUMENT_MIME_EXTENSIONS[file.mimetype]) {
          cb(new BadRequestException('فرمت فایل مجاز نیست'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadDocuments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: Express.Multer.File[],
  ) {
    try {
      const signaturesAreValid = await Promise.all(
        (files ?? []).map((file) =>
          fileHasExpectedSignature(file.path, file.mimetype),
        ),
      );
      if (signaturesAreValid.some((isValid) => !isValid)) {
        throw new BadRequestException('محتوای یک یا چند فایل معتبر نیست');
      }
      return await this.petsService.addDocuments(req.user.sub, id, files);
    } catch (error) {
      await removeUploadedFiles(files ?? []);
      throw error;
    }
  }

  @Get(':id/documents/:documentId/download')
  @ApiOperation({ summary: 'Download an authorized pet document' })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiProduces(
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  )
  @ApiOkResponse({ description: 'Document file stream' })
  async downloadDocument(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.petsService.getDocument(
      req.user.sub,
      id,
      documentId,
    );
    const path = join(process.cwd(), document.fileUrl.replace(/^[/\\]+/, ''));
    try {
      await access(path);
    } catch {
      throw new NotFoundException('فایل روی سرور یافت نشد');
    }

    response.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
    });

    return new StreamableFile(createReadStream(path));
  }

  @Post(':id/submit')
  @ApiOperation({
    summary: 'Submit pet registration',
    description:
      'Validates all required fields and changes status from draft to active. Required: name, type, gender, birthDate|approximateAge, weight, height, healthStatus, vaccinationStatus, foodType, mealsPerDay.',
  })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetSubmitResponseDto })
  submit(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petsService.submit(req.user.sub, id);
  }

  @Post(':id/photo')
  @ApiOperation({
    summary: 'Upload or replace the pet photo',
    description: 'One image (JPG, PNG or WEBP), up to 5MB.',
  })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['photo'],
      properties: { photo: { type: 'string', format: 'binary' } },
    },
  })
  @ApiOkResponse({ type: PetResponseDto })
  @UseInterceptors(
    FileInterceptor('photo', imageUploadOptions(PHOTO_MAX_BYTES)),
  )
  async uploadPhoto(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    // 404 before anything is written to disk.
    await this.petsService.findOneByOwner(req.user.sub, id);
    const photoUrl = await saveImage(file, PET_PHOTO_DIRECTORY);
    try {
      return await this.petsService.setPhoto(req.user.sub, id, photoUrl);
    } catch (error) {
      await removeUploadUrls([photoUrl]);
      throw error;
    }
  }

  @Delete(':id/photo')
  @ApiOperation({ summary: 'Remove the pet photo' })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetResponseDto })
  deletePhoto(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petsService.removePhoto(req.user.sub, id);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Delete a pet (draft or registered)',
    description:
      'Registered pets with an upcoming appointment cannot be deleted; cancel it first.',
  })
  @ApiParam({ name: 'id', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetDeleteResponseDto })
  deletePet(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.petsService.deletePet(req.user.sub, id);
  }
}
