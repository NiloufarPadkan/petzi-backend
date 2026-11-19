import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import {
  LOGO_MAX_BYTES,
  IMAGE_MAX_BYTES,
  clinicImageUploadOptions,
  saveClinicImage,
} from '../clinics/clinic-media';
import { ClinicServicesService } from '../clinics/clinic-services.service';
import { ClinicWorkingHoursService } from '../clinics/clinic-working-hours.service';
import {
  CreateVetClinicServiceDto,
  UpdateVetClinicServiceDto,
} from '../vets/dto/vet-clinic-service.dto';
import { SetVetWorkingDayDto } from '../vets/dto/vet-working-hours.dto';
import { ClinicPermission } from './clinic-panel.constants';
import {
  ClinicPanel,
  CurrentClinic,
  RequirePermission,
} from './clinic-panel.guard';
import type { ClinicContext } from './clinic-panel.guard';
import { ClinicProfileService } from './clinic-profile.service';
import {
  PanelUpdateClinicDto,
  UpdatePanelNotificationsDto,
} from './dto/profile.dto';

const FILE_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

@ApiTags('Clinic Profile')
@ClinicPanel()
@Controller('clinic/profile')
export class ClinicProfileController {
  constructor(private readonly profileService: ClinicProfileService) {}

  @Get()
  @ApiOperation({
    summary: 'Clinic info plus the signed-in member and permissions',
  })
  get(@CurrentClinic() ctx: ClinicContext) {
    return this.profileService.getProfile(ctx);
  }

  @Patch()
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  update(
    @CurrentClinic() ctx: ClinicContext,
    @Body() dto: PanelUpdateClinicDto,
  ) {
    return this.profileService.update(ctx, dto);
  }

  @Post('logo')
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(
    FileInterceptor('file', clinicImageUploadOptions(LOGO_MAX_BYTES)),
  )
  async uploadLogo(
    @CurrentClinic() ctx: ClinicContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.setMedia(
      ctx,
      'logoUrl',
      await saveClinicImage(file),
    );
  }

  @Delete('logo')
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  deleteLogo(@CurrentClinic() ctx: ClinicContext) {
    return this.profileService.setMedia(ctx, 'logoUrl', null);
  }

  @Post('cover')
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(
    FileInterceptor('file', clinicImageUploadOptions(IMAGE_MAX_BYTES)),
  )
  async uploadCover(
    @CurrentClinic() ctx: ClinicContext,
    @UploadedFile() file: Express.Multer.File,
  ) {
    return this.profileService.setMedia(
      ctx,
      'coverImageUrl',
      await saveClinicImage(file),
    );
  }

  @Delete('cover')
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  deleteCover(@CurrentClinic() ctx: ClinicContext) {
    return this.profileService.setMedia(ctx, 'coverImageUrl', null);
  }

  @Get('notifications')
  notifications(@CurrentClinic() ctx: ClinicContext) {
    return this.profileService.getNotifications(ctx);
  }

  @Patch('notifications')
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  updateNotifications(
    @CurrentClinic() ctx: ClinicContext,
    @Body() dto: UpdatePanelNotificationsDto,
  ) {
    return this.profileService.updateNotifications(ctx, dto);
  }
}

@ApiTags('Clinic Services')
@ClinicPanel()
@Controller('clinic/services')
export class ClinicServicesController {
  constructor(private readonly servicesService: ClinicServicesService) {}

  @Get()
  list(@CurrentClinic() ctx: ClinicContext) {
    return this.servicesService.findAll(ctx.clinicId);
  }

  @Post()
  @RequirePermission(ClinicPermission.SERVICES_MANAGE)
  create(
    @CurrentClinic() ctx: ClinicContext,
    @Body() dto: CreateVetClinicServiceDto,
  ) {
    return this.servicesService.create(ctx.clinicId, dto);
  }

  @Patch(':serviceId')
  @RequirePermission(ClinicPermission.SERVICES_MANAGE)
  update(
    @CurrentClinic() ctx: ClinicContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpdateVetClinicServiceDto,
  ) {
    return this.servicesService.update(ctx.clinicId, serviceId, dto);
  }

  @Delete(':serviceId')
  @RequirePermission(ClinicPermission.SERVICES_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentClinic() ctx: ClinicContext,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.servicesService.remove(ctx.clinicId, serviceId);
  }
}

@ApiTags('Clinic Working Hours')
@ClinicPanel()
@Controller('clinic/working-hours')
export class ClinicWorkingHoursController {
  constructor(private readonly hoursService: ClinicWorkingHoursService) {}

  @Get()
  @ApiOperation({ summary: 'All seven days; unconfigured days are closed' })
  list(@CurrentClinic() ctx: ClinicContext) {
    return this.hoursService.findAll(ctx.clinicId);
  }

  @Put(':day')
  @RequirePermission(ClinicPermission.CLINIC_EDIT)
  @ApiOperation({ summary: 'Set one day (0 = Saturday … 6 = Friday)' })
  setDay(
    @CurrentClinic() ctx: ClinicContext,
    @Param('day', ParseIntPipe) day: number,
    @Body() dto: SetVetWorkingDayDto,
  ) {
    return this.hoursService.setDay(ctx.clinicId, day, dto, ctx.userId);
  }
}
