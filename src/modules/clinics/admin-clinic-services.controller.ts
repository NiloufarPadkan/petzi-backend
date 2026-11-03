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
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import {
  CreateVetClinicServiceDto,
  UpdateVetClinicServiceDto,
  VetClinicServiceResponseDto,
} from '../vets/dto/vet-clinic-service.dto';
import { ClinicServicesService } from './clinic-services.service';

@ApiTags('Admin Clinics')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
@Controller('admin/clinics/:id/services')
export class AdminClinicServicesController {
  constructor(private readonly servicesService: ClinicServicesService) {}

  @Get()
  @ApiOperation({ summary: "List a clinic's services and prices" })
  @ApiOkResponse({ type: [VetClinicServiceResponseDto] })
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.servicesService.findAll(id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a service' })
  @ApiCreatedResponse({ type: VetClinicServiceResponseDto })
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateVetClinicServiceDto,
  ) {
    return this.servicesService.create(id, dto);
  }

  @Patch(':serviceId')
  @ApiOperation({
    summary: 'Update a service (send only isActive to toggle it)',
  })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiOkResponse({ type: VetClinicServiceResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
    @Body() dto: UpdateVetClinicServiceDto,
  ) {
    return this.servicesService.update(id, serviceId, dto);
  }

  @Delete(':serviceId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a service' })
  @ApiParam({ name: 'serviceId', description: 'Service UUID' })
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('serviceId', ParseUUIDPipe) serviceId: string,
  ) {
    return this.servicesService.remove(id, serviceId);
  }
}
