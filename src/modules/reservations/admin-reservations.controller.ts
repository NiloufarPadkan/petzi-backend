import {
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
} from '@nestjs/common';
import { ApiNoContentResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  CancelReservationDto,
  ChangeReservationStatusDto,
  CreateReservationDto,
  QueryReservationsDto,
  RescheduleReservationDto,
  ReservationNoteDto,
  UpdateReservationDto,
} from './dto/reservation.dto';
import { ReservationsService } from './reservations.service';

@ApiTags('Admin Reservations')
@AdminOnly()
@Controller('admin/reservations')
export class AdminReservationsController {
  constructor(private readonly reservationsService: ReservationsService) {}

  @Get()
  @ApiOperation({
    summary:
      'List reservations (filter by owner/pet/vet/clinic for detail tabs)',
  })
  findAll(@Query() query: QueryReservationsDto) {
    return this.reservationsService.findAll(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Counts by status and today’s active bookings' })
  stats() {
    return this.reservationsService.getStats();
  }

  @Get(':id')
  @ApiOperation({
    summary: 'Full detail: parties, payment, notes and history timeline',
  })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.findOne(id);
  }

  @Post()
  create(@Body() dto: CreateReservationDto, @Req() req: AuthenticatedRequest) {
    return this.reservationsService.create(dto, req.user.sub);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateReservationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reservationsService.update(id, dto, req.user.sub);
  }

  @Patch(':id/time')
  @ApiOperation({ summary: 'Change the reservation time' })
  reschedule(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: RescheduleReservationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reservationsService.reschedule(id, dto, req.user.sub);
  }

  @Patch(':id/status')
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeReservationStatusDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reservationsService.changeStatus(id, dto.status, req.user.sub);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelReservationDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reservationsService.cancel(id, dto.reason, req.user.sub);
  }

  @Post(':id/notes')
  addNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservationNoteDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.reservationsService.addNote(id, dto.text, req.user.sub);
  }

  @Delete(':id/notes/:noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeNote(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.reservationsService.removeNote(id, noteId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.reservationsService.remove(id);
  }
}
