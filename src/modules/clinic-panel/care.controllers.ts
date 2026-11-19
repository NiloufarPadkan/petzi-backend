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
  Query,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import {
  IMAGE_MAX_BYTES,
  clinicImageUploadOptions,
  saveClinicImage,
} from '../clinics/clinic-media';
import {
  CancelReservationDto,
  ChangeReservationStatusDto,
  RescheduleReservationDto,
  ReservationNoteDto,
} from '../reservations/dto/reservation.dto';
import { ClinicPatientsService } from './clinic-patients.service';
import { ClinicPermission } from './clinic-panel.constants';
import {
  ClinicPanel,
  CurrentClinic,
  RequirePermission,
} from './clinic-panel.guard';
import type { ClinicContext } from './clinic-panel.guard';
import { ClinicReservationsService } from './clinic-reservations.service';
import {
  CalendarQueryDto,
  PanelCreateReservationDto,
  PanelQueryReservationsDto,
  PanelUpdateReservationDto,
} from './dto/panel-reservations.dto';
import {
  AddPatientDto,
  CreateRecordDto,
  QueryPatientsDto,
  UpdatePatientDto,
  UpdateRecordDto,
} from './dto/patients.dto';

const FILE_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

@ApiTags('Clinic Reservations')
@ClinicPanel(ClinicPermission.RESERVATIONS_VIEW)
@Controller('clinic/reservations')
export class ClinicReservationsController {
  constructor(
    private readonly reservationsService: ClinicReservationsService,
  ) {}

  @Get()
  @ApiOperation({
    summary: 'Reservations; scope=today for the day list, or filter and sort',
  })
  list(
    @CurrentClinic() ctx: ClinicContext,
    @Query() query: PanelQueryReservationsDto,
  ) {
    return this.reservationsService.list(ctx, query);
  }

  @Get('calendar')
  @ApiOperation({
    summary: 'Per-day counts (Tehran calendar) for a date range',
  })
  calendar(
    @CurrentClinic() ctx: ClinicContext,
    @Query() query: CalendarQueryDto,
  ) {
    return this.reservationsService.calendar(ctx, query);
  }

  @Get(':id')
  get(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservationsService.findOne(ctx, id);
  }

  @Post()
  @RequirePermission(ClinicPermission.RESERVATIONS_MANAGE)
  @ApiOperation({ summary: 'Create a reservation (confirmed by default)' })
  create(
    @CurrentClinic() ctx: ClinicContext,
    @Body() dto: PanelCreateReservationDto,
  ) {
    return this.reservationsService.create(ctx, dto);
  }

  @Patch(':id')
  @RequirePermission(ClinicPermission.RESERVATIONS_MANAGE)
  update(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: PanelUpdateReservationDto,
  ) {
    return this.reservationsService.update(ctx, id, dto);
  }

  @Patch(':id/time')
  @RequirePermission(ClinicPermission.RESERVATIONS_MANAGE)
  reschedule(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleReservationDto,
  ) {
    return this.reservationsService.reschedule(ctx, id, dto);
  }

  @Patch(':id/status')
  @RequirePermission(ClinicPermission.RESERVATIONS_MANAGE)
  @ApiOperation({ summary: 'Confirm, complete or mark no-show' })
  changeStatus(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeReservationStatusDto,
  ) {
    return this.reservationsService.changeStatus(ctx, id, dto.status);
  }

  @Post(':id/decline')
  @RequirePermission(ClinicPermission.RESERVATIONS_CANCEL)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a pending request' })
  decline(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.decline(ctx, id, dto.reason);
  }

  @Post(':id/cancel')
  @RequirePermission(ClinicPermission.RESERVATIONS_CANCEL)
  @HttpCode(HttpStatus.OK)
  cancel(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
  ) {
    return this.reservationsService.cancel(ctx, id, dto.reason);
  }

  @Post(':id/notes')
  @RequirePermission(ClinicPermission.RESERVATIONS_MANAGE)
  addNote(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservationNoteDto,
  ) {
    return this.reservationsService.addNote(ctx, id, dto.text);
  }

  @Delete(':id/notes/:noteId')
  @RequirePermission(ClinicPermission.RESERVATIONS_MANAGE)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeNote(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.reservationsService.removeNote(ctx, id, noteId);
  }

  @Delete(':id')
  @RequirePermission(ClinicPermission.RESERVATIONS_CANCEL)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @CurrentClinic() ctx: ClinicContext,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.reservationsService.remove(ctx, id);
  }
}

@ApiTags('Clinic Patients')
@ClinicPanel(ClinicPermission.PATIENTS_VIEW)
@Controller('clinic/patients')
export class ClinicPatientsController {
  constructor(private readonly patientsService: ClinicPatientsService) {}

  @Get()
  @ApiOperation({ summary: 'Patients: pets added by or booked at the clinic' })
  list(@CurrentClinic() ctx: ClinicContext, @Query() query: QueryPatientsDto) {
    return this.patientsService.list(ctx, query);
  }

  @Post()
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  @ApiOperation({
    summary: 'Add a patient: an existing pet, or a new pet with its owner',
  })
  add(@CurrentClinic() ctx: ClinicContext, @Body() dto: AddPatientDto) {
    return this.patientsService.add(ctx, dto);
  }

  @Get(':petId')
  @ApiOperation({ summary: 'General info plus reservation history' })
  get(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.patientsService.findOne(ctx, petId);
  }

  @Patch(':petId')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  update(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: UpdatePatientDto,
  ) {
    return this.patientsService.update(ctx, petId, dto);
  }

  @Delete(':petId')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({
    summary: 'Remove from the patient list (history and records are kept)',
  })
  @ApiNoContentResponse()
  archive(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.patientsService.archive(ctx, petId);
  }

  // ---- medical records ----

  @Get(':petId/records')
  records(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.patientsService.listRecords(ctx, petId, query);
  }

  @Get(':petId/records/:recordId')
  record(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.patientsService.getRecord(ctx, petId, recordId);
  }

  @Post(':petId/records')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  createRecord(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: CreateRecordDto,
  ) {
    return this.patientsService.createRecord(ctx, petId, dto);
  }

  @Patch(':petId/records/:recordId')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  updateRecord(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Body() dto: UpdateRecordDto,
  ) {
    return this.patientsService.updateRecord(ctx, petId, recordId, dto);
  }

  @Delete(':petId/records/:recordId')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  deleteRecord(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
  ) {
    return this.patientsService.deleteRecord(ctx, petId, recordId);
  }

  @Post(':petId/records/:recordId/images')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(
    FileInterceptor('file', clinicImageUploadOptions(IMAGE_MAX_BYTES)),
  )
  async uploadRecordImage(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.patientsService.getRecord(ctx, petId, recordId);
    const url = await saveClinicImage(file);
    return this.patientsService.addRecordImage(ctx, petId, recordId, url);
  }

  @Delete(':petId/records/:recordId/images/:index')
  @RequirePermission(ClinicPermission.PATIENTS_EDIT)
  deleteRecordImage(
    @CurrentClinic() ctx: ClinicContext,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('recordId', ParseUUIDPipe) recordId: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.patientsService.removeRecordImage(ctx, petId, recordId, index);
  }
}
