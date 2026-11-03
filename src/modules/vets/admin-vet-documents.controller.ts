import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Req,
  Res,
  StreamableFile,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { diskStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { createReadStream, mkdirSync } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { fileHasExpectedSignature } from '../../common/utils/file-signature';
import { removeUploadedFiles } from '../../common/utils/upload-cleanup';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  RejectVetDocumentsDto,
  SetVetDocumentStatusDto,
  UploadVetDocumentDto,
  VetDocumentResponseDto,
} from './dto/vet-document.dto';
import { VetDocumentsService } from './vet-documents.service';

const DOCUMENT_MIME_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'application/pdf': '.pdf',
};

const documentUploadDirectory = join(process.cwd(), 'uploads', 'vet-documents');
mkdirSync(documentUploadDirectory, { recursive: true });

const documentStorage = diskStorage({
  destination: documentUploadDirectory,
  filename: (_req, file, cb) => {
    cb(null, `${randomUUID()}${DOCUMENT_MIME_EXTENSIONS[file.mimetype]}`);
  },
});

@ApiTags('Admin Vets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'Vet (user) UUID' })
@Controller('admin/vets/:id/documents')
export class AdminVetDocumentsController {
  constructor(private readonly documentsService: VetDocumentsService) {}

  @Get()
  @ApiOperation({ summary: 'List the identity/licence documents of a vet' })
  @ApiOkResponse({ type: [VetDocumentResponseDto] })
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.documentsService.findAll(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Upload a document for a vet',
    description: 'PNG, JPG, WEBP or PDF, max 10MB.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'file'],
      properties: {
        title: { type: 'string', example: 'کارت نظام دامپزشکی' },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: VetDocumentResponseDto })
  @UseInterceptors(
    FileInterceptor('file', {
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
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadVetDocumentDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('فایل ارسال نشد');
    }
    try {
      if (!(await fileHasExpectedSignature(file.path, file.mimetype))) {
        throw new BadRequestException('محتوای فایل معتبر نیست');
      }
      return await this.documentsService.create(id, dto.title, file);
    } catch (error) {
      await removeUploadedFiles([file]);
      throw error;
    }
  }

  @Post('approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Approve all documents',
    description: 'Marks every document and the vet as approved.',
  })
  @ApiOkResponse({ type: [VetDocumentResponseDto] })
  approveAll(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.documentsService.approveAll(id, req.user.sub);
  }

  @Post('reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Reject all documents with a message for the vet',
    description:
      'Marks every document and the vet as rejected; the message is stored as the rejection reason.',
  })
  @ApiOkResponse({ type: [VetDocumentResponseDto] })
  rejectAll(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RejectVetDocumentsDto,
  ) {
    return this.documentsService.rejectAll(id, dto, req.user.sub);
  }

  @Patch(':documentId/status')
  @ApiOperation({ summary: 'Set the status of a single document' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiOkResponse({ type: VetDocumentResponseDto })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Body() dto: SetVetDocumentStatusDto,
  ) {
    return this.documentsService.setStatus(id, documentId, dto);
  }

  @Get(':documentId/download')
  @ApiOperation({ summary: 'Download a document' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiProduces('application/pdf', 'image/png', 'image/jpeg', 'image/webp')
  @ApiOkResponse({ description: 'Document file stream' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.documentsService.getForDownload(id, documentId);
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

  @Delete(':documentId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
  ) {
    return this.documentsService.remove(id, documentId);
  }
}
