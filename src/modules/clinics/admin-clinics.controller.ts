import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
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
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  ClinicActivityStatus,
  ClinicLogType,
  ClinicType,
  ClinicVerificationStatus,
} from '../../common/enums/clinic-enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  IMAGE_MAX_BYTES,
  LOGO_MAX_BYTES,
  clinicImageUploadOptions,
  saveClinicImage,
} from './clinic-media';
import { ClinicsService } from './clinics.service';
import {
  ChangeClinicActivityStatusDto,
  ChangeClinicVerificationStatusDto,
  SuspendClinicDto,
} from './dto/clinic-status.dto';
import {
  ClinicDetailDto,
  ClinicListResponseDto,
  ClinicLogDto,
} from './dto/clinic-response.dto';
import { CreateClinicDto } from './dto/create-clinic.dto';
import { QueryClinicsDto } from './dto/query-clinics.dto';
import { UpdateClinicDto } from './dto/update-clinic.dto';

const TYPE_LABELS: Record<ClinicType, string> = {
  [ClinicType.CLINIC]: 'کلینیک دامپزشکی',
  [ClinicType.HOSPITAL]: 'بیمارستان دامپزشکی',
  [ClinicType.SPECIALTY_CLINIC]: 'کلینیک تخصصی',
};

const VERIFICATION_LABELS: Record<ClinicVerificationStatus, string> = {
  [ClinicVerificationStatus.PENDING]: 'در انتظار تایید',
  [ClinicVerificationStatus.APPROVED]: 'تایید شده',
  [ClinicVerificationStatus.REJECTED]: 'رد شده',
  [ClinicVerificationStatus.NEEDS_EDIT]: 'نیاز به ویرایش',
};

const ACTIVITY_LABELS: Record<ClinicActivityStatus, string> = {
  [ClinicActivityStatus.ACTIVE]: 'فعال',
  [ClinicActivityStatus.INACTIVE]: 'غیرفعال',
  [ClinicActivityStatus.SUSPENDED]: 'معلق',
};

const imageUploadBody = (field: string) => ({
  schema: {
    type: 'object' as const,
    properties: { [field]: { type: 'string' as const, format: 'binary' } },
  },
});

@ApiTags('Admin Clinics')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/clinics')
export class AdminClinicsController {
  constructor(private readonly clinicsService: ClinicsService) {}

  @Get()
  @ApiOperation({ summary: 'List clinics with search/filter/pagination' })
  @ApiOkResponse({ type: ClinicListResponseDto })
  findAll(@Query() query: QueryClinicsDto) {
    return this.clinicsService.findAll(query);
  }

  @Post()
  @ApiOperation({ summary: 'Add a clinic' })
  @ApiCreatedResponse({ type: ClinicDetailDto })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateClinicDto) {
    return this.clinicsService.create(dto, req.user.sub);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export the filtered clinic list as an Excel file' })
  async export(@Query() query: QueryClinicsDto, @Res() res: Response) {
    const items = await this.clinicsService.findAllForExport(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Clinics');
    sheet.columns = [
      { header: 'نام کلینیک/مرکز', key: 'name', width: 30 },
      { header: 'نوع مرکز', key: 'type', width: 20 },
      { header: 'استان', key: 'province', width: 15 },
      { header: 'شهر', key: 'city', width: 15 },
      { header: 'شماره تماس', key: 'phone', width: 18 },
      { header: 'وضعیت تایید', key: 'verificationStatus', width: 15 },
      { header: 'وضعیت فعالیت', key: 'activityStatus', width: 15 },
      { header: 'تاریخ ثبت', key: 'createdAt', width: 15 },
    ];
    for (const item of items) {
      sheet.addRow({
        name: item.name,
        type: TYPE_LABELS[item.type],
        province: item.province,
        city: item.city,
        phone: item.phone,
        verificationStatus: VERIFICATION_LABELS[item.verificationStatus],
        activityStatus: ACTIVITY_LABELS[item.activityStatus],
        createdAt: item.createdAt.toISOString().slice(0, 10),
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader('Content-Disposition', 'attachment; filename="clinics.xlsx"');
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a clinic (profile, rating and stats)' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a clinic (partial)' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  update(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateClinicDto,
  ) {
    return this.clinicsService.update(id, dto, req.user.sub);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Delete (soft-delete) a clinic',
    description: 'Vets linked to the clinic are unlinked.',
  })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.remove(id);
  }

  @Patch(':id/verification-status')
  @ApiOperation({ summary: 'Change the verification status' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  changeVerificationStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeClinicVerificationStatusDto,
  ) {
    return this.clinicsService.changeStatus(
      id,
      { verificationStatus: dto.status, reason: dto.reason },
      req.user.sub,
    );
  }

  @Patch(':id/activity-status')
  @ApiOperation({
    summary: 'Change the activity status',
    description:
      'Setting it to "suspended" blocks the clinic account from signing in; any other value lifts the block.',
  })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  changeActivityStatus(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeClinicActivityStatusDto,
  ) {
    return this.clinicsService.changeStatus(
      id,
      { activityStatus: dto.status, reason: dto.reason },
      req.user.sub,
    );
  }

  @Post(':id/suspend')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Suspend (ban) the clinic account' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  suspend(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SuspendClinicDto,
  ) {
    return this.clinicsService.changeStatus(
      id,
      { activityStatus: ClinicActivityStatus.SUSPENDED, reason: dto.reason },
      req.user.sub,
    );
  }

  @Get(':id/logs')
  @ApiOperation({
    summary: 'Status and schedule change history (newest first)',
  })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiQuery({ name: 'type', enum: ClinicLogType, required: false })
  @ApiOkResponse({ type: [ClinicLogDto] })
  findLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('type', new ParseEnumPipe(ClinicLogType, { optional: true }))
    type?: ClinicLogType,
  ) {
    return this.clinicsService.findLogs(id, type);
  }

  @Post(':id/logo')
  @ApiOperation({ summary: 'Upload the clinic logo (JPG/PNG/WEBP, max 2MB)' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(imageUploadBody('logo'))
  @UseInterceptors(
    FileInterceptor('logo', clinicImageUploadOptions(LOGO_MAX_BYTES)),
  )
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.clinicsService.getClinicOrThrow(id);
    return this.clinicsService.setMedia(
      id,
      'logoUrl',
      await saveClinicImage(file),
    );
  }

  @Delete(':id/logo')
  @ApiOperation({ summary: 'Remove the clinic logo' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  removeLogo(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.setMedia(id, 'logoUrl', null);
  }

  @Post(':id/cover-image')
  @ApiOperation({
    summary: 'Upload the main clinic image (JPG/PNG/WEBP, max 5MB)',
  })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody(imageUploadBody('coverImage'))
  @UseInterceptors(
    FileInterceptor('coverImage', clinicImageUploadOptions(IMAGE_MAX_BYTES)),
  )
  async uploadCoverImage(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.clinicsService.getClinicOrThrow(id);
    return this.clinicsService.setMedia(
      id,
      'coverImageUrl',
      await saveClinicImage(file),
    );
  }

  @Delete(':id/cover-image')
  @ApiOperation({ summary: 'Remove the main clinic image' })
  @ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
  @ApiOkResponse({ type: ClinicDetailDto })
  removeCoverImage(@Param('id', ParseUUIDPipe) id: string) {
    return this.clinicsService.setMedia(id, 'coverImageUrl', null);
  }
}
