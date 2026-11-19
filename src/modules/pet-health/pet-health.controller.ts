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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  CreateEventDto,
  CreateMedicationDto,
  CreateSurgeryDto,
  CreateWeightDto,
  TimelineQueryDto,
  UpdateEventDto,
  UpdateMedicationDto,
  UpdateSurgeryDto,
  UpdateVaccineDto,
  WeightsQueryDto,
} from './dto/pet-health.dto';
import { PetHealthService } from './pet-health.service';

@ApiTags('Pet Health')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@ApiParam({ name: 'petId', description: 'Pet UUID' })
@Controller('pets/:petId')
export class PetHealthController {
  constructor(private readonly healthService: PetHealthService) {}

  @Get('health')
  @ApiOperation({
    summary: 'Medical info screen: status, medications, surgeries, vaccines',
  })
  overview(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.healthService.overview(req.user.sub, petId);
  }

  @Get('timeline')
  @ApiOperation({
    summary: 'Health timeline (reservations, vaccines, events, weights, …)',
  })
  timeline(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query() query: TimelineQueryDto,
  ) {
    return this.healthService.timeline(req.user.sub, petId, query);
  }

  // ---- weights ----

  @Get('weights')
  @ApiOperation({ summary: 'Weight chart points and stats' })
  weights(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query() query: WeightsQueryDto,
  ) {
    return this.healthService.listWeights(req.user.sub, petId, query);
  }

  @Post('weights')
  addWeight(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: CreateWeightDto,
  ) {
    return this.healthService.addWeight(req.user.sub, petId, dto);
  }

  @Delete('weights/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeWeight(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.removeWeight(req.user.sub, petId, id);
  }

  // ---- events ----

  @Get('events')
  events(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.healthService.listEvents(req.user.sub, petId);
  }

  @Post('events')
  addEvent(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: CreateEventDto,
  ) {
    return this.healthService.addEvent(req.user.sub, petId, dto);
  }

  @Patch('events/:id')
  updateEvent(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateEventDto,
  ) {
    return this.healthService.updateEvent(req.user.sub, petId, id, dto);
  }

  @Delete('events/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeEvent(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.removeEvent(req.user.sub, petId, id);
  }

  // ---- medications ----

  @Get('medications')
  medications(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Query('active') active?: string,
  ) {
    return this.healthService.listMedications(
      req.user.sub,
      petId,
      active === 'true',
    );
  }

  @Post('medications')
  addMedication(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: CreateMedicationDto,
  ) {
    return this.healthService.addMedication(req.user.sub, petId, dto);
  }

  @Patch('medications/:id')
  updateMedication(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateMedicationDto,
  ) {
    return this.healthService.updateMedication(req.user.sub, petId, id, dto);
  }

  @Delete('medications/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeMedication(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.removeMedication(req.user.sub, petId, id);
  }

  // ---- surgeries ----

  @Get('surgeries')
  surgeries(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.healthService.listSurgeries(req.user.sub, petId);
  }

  @Post('surgeries')
  addSurgery(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: CreateSurgeryDto,
  ) {
    return this.healthService.addSurgery(req.user.sub, petId, dto);
  }

  @Patch('surgeries/:id')
  updateSurgery(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateSurgeryDto,
  ) {
    return this.healthService.updateSurgery(req.user.sub, petId, id, dto);
  }

  @Post('surgeries/:id/cancel')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Cancel a scheduled surgery' })
  cancelSurgery(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.cancelSurgery(req.user.sub, petId, id);
  }

  @Delete('surgeries/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeSurgery(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.removeSurgery(req.user.sub, petId, id);
  }

  // ---- vaccines & documents (adding them stays on POST /pets/:id/...) ----

  @Get('vaccines')
  vaccines(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.healthService.listVaccines(req.user.sub, petId);
  }

  @Patch('vaccines/:id')
  updateVaccine(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateVaccineDto,
  ) {
    return this.healthService.updateVaccine(req.user.sub, petId, id, dto);
  }

  @Delete('vaccines/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeVaccine(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.removeVaccine(req.user.sub, petId, id);
  }

  @Delete('documents/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeDocument(
    @Req() req: AuthenticatedRequest,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.healthService.removeDocument(req.user.sub, petId, id);
  }
}
