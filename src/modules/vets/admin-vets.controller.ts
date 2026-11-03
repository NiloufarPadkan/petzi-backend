import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { memoryStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ApprovalStatus } from '../../common/enums/approval-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { VetCollaborationStatus } from '../../common/enums/vet-collaboration-status.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { hasExpectedFileSignature } from '../../common/utils/file-signature';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { CreateVetDto } from './dto/create-vet.dto';
import { QueryVetsDto } from './dto/query-vets.dto';
import { UpdateVetDto } from './dto/update-vet.dto';
import {
  ChangeCollaborationStatusDto,
  ChangeVerificationStatusDto,
  SuspendVetDto,
} from './dto/vet-status.dto';
import {
  VetDetailDto,
  VetListResponseDto,
  VetStatusLogDto,
} from './dto/vet-response.dto';
import { VetsService } from './vets.service';

const PROFILE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const VERIFICATION_LABELS: Record<ApprovalStatus, string> = {
  [ApprovalStatus.PENDING]: 'در انتظار تایید',
  [ApprovalStatus.APPROVED]: 'تایید شده',
  [ApprovalStatus.REJECTED]: 'رد شده',
};

const COLLABORATION_LABELS: Record<VetCollaborationStatus, string> = {
  [VetCollaborationStatus.ACTIVE]: 'فعال',
  [VetCollaborationStatus.INACTIVE]: 'غیرفعال',
  [VetCollaborationStatus.SUSPENDED]: 'معلق',
};

@ApiTags('Admin Vets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/vets')
export class AdminVetsController {
  constructor(private readonly vetsService: VetsService) {}

  @Get()
  @ApiOperation({ summary: 'List vets with search/filter/pagination' })
  @ApiOkResponse({ type: VetListResponseDto })
  findAll(@Query() query: QueryVetsDto) {
    return this.vetsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a vet' })
  @ApiCreatedResponse({ type: VetDetailDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateVetDto) {
    return this.vetsService.create(dto, req.user.sub);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export the filtered vet list as an Excel file' })
  async export(@Query() query: QueryVetsDto, @Res() res: Response) {
    const items = await this.vetsService.findAllForExport(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Vets');
    sheet.columns = [
      { header: 'نام', key: 'fullName', width: 25 },
      { header: 'ایمیل', key: 'email', width: 30 },
      { header: 'شماره موبایل', key: 'phoneNumber', width: 18 },
      { header: 'شماره نظام', key: 'medicalCouncilNumber', width: 15 },
      { header: 'تخصص', key: 'primarySpecialty', width: 22 },
      { header: 'کلینیک', key: 'clinicName', width: 25 },
      { header: 'شهر', key: 'city', width: 15 },
      { header: 'وضعیت تایید', key: 'verificationStatus', width: 15 },
      { header: 'وضعیت همکاری', key: 'collaborationStatus', width: 15 },
    ];
    for (const item of items) {
      sheet.addRow({
        fullName: item.fullName ?? '',
        email: item.email ?? '',
        phoneNumber: item.phoneNumber,
        medicalCouncilNumber: item.medicalCouncilNumber,
        primarySpecialty: item.primarySpecialty,
        clinicName: item.clinicName ?? '',
        city: item.city,
        verificationStatus: VERIFICATION_LABELS[item.verificationStatus],
        collaborationStatus: COLLABORATION_LABELS[item.collaborationStatus],
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="vets.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a vet (profile, rating and stats)' })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: VetDetailDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.vetsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a vet (partial)' })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: VetDetailDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVetDto,
  ) {
    return this.vetsService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (soft-delete) a vet' })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.vetsService.remove(id);
  }

  @Patch(':id/verification-status')
  @ApiOperation({ summary: 'Change the verification (document) status' })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: VetDetailDto })
  changeVerificationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeVerificationStatusDto,
  ) {
    return this.vetsService.changeStatus(
      id,
      { verificationStatus: dto.status, reason: dto.reason },
      req.user.sub,
    );
  }

  @Patch(':id/collaboration-status')
  @ApiOperation({
    summary: 'Change the collaboration status',
    description:
      'Setting it to "suspended" blocks the vet from signing in; any other value lifts the block.',
  })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: VetDetailDto })
  changeCollaborationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeCollaborationStatusDto,
  ) {
    return this.vetsService.changeStatus(
      id,
      { collaborationStatus: dto.status, reason: dto.reason },
      req.user.sub,
    );
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend the vet account' })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: VetDetailDto })
  suspend(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendVetDto,
  ) {
    return this.vetsService.changeStatus(
      id,
      {
        collaborationStatus: VetCollaborationStatus.SUSPENDED,
        reason: dto.reason,
      },
      req.user.sub,
    );
  }

  @Get(':id/status-logs')
  @ApiOperation({ summary: 'Status change history (newest first)' })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: [VetStatusLogDto] })
  findStatusLogs(@Param('id', ParseUUIDPipe) id: string) {
    return this.vetsService.findStatusLogs(id);
  }

  @Post(':id/profile-picture')
  @ApiOperation({ summary: "Upload a vet's profile picture" })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { profilePicture: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!PROFILE_MIME_EXTENSIONS[file.mimetype]) {
          cb(new BadRequestException('فقط فایل‌های تصویری مجاز هستند'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadProfilePicture(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('فایل تصویر ارسال نشد');
    }
    if (!hasExpectedFileSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('محتوای فایل تصویر معتبر نیست');
    }
    await this.vetsService.getVetOrThrow(id);

    const filename = `${randomUUID()}${PROFILE_MIME_EXTENSIONS[file.mimetype]}`;
    const directory = join(process.cwd(), 'uploads', 'profile-pictures');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer);

    return this.vetsService.updateProfilePicture(
      id,
      `/uploads/profile-pictures/${filename}`,
    );
  }

  @Delete(':id/profile-picture')
  @ApiOperation({ summary: "Remove a vet's profile picture" })
  @ApiParam({ name: 'id', description: 'Vet (user) UUID' })
  @ApiOkResponse({ type: VetDetailDto })
  removeProfilePicture(@Param('id', ParseUUIDPipe) id: string) {
    return this.vetsService.removeProfilePicture(id);
  }
}
