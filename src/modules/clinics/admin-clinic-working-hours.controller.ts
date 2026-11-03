import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  SetVetWorkingDayDto,
  VetWorkingDayResponseDto,
} from '../vets/dto/vet-working-hours.dto';
import { ClinicWorkingHoursService } from './clinic-working-hours.service';

@ApiTags('Admin Clinics')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
@Controller('admin/clinics/:id/working-hours')
export class AdminClinicWorkingHoursController {
  constructor(private readonly hoursService: ClinicWorkingHoursService) {}

  @Get()
  @ApiOperation({ summary: "The clinic's weekly schedule (7 days)" })
  @ApiOkResponse({ type: [VetWorkingDayResponseDto] })
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.hoursService.findAll(id);
  }

  @Put(':day')
  @ApiOperation({
    summary: 'Set the schedule of one weekday',
    description: 'Every change is recorded in the clinic logs.',
  })
  @ApiParam({
    name: 'day',
    description: 'Day of week: 0 = Saturday … 6 = Friday',
  })
  @ApiOkResponse({ type: VetWorkingDayResponseDto })
  setDay(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day', ParseIntPipe) day: number,
    @Body() dto: SetVetWorkingDayDto,
  ) {
    if (day < 0 || day > 6) {
      throw new BadRequestException('روز هفته باید بین ۰ تا ۶ باشد');
    }
    return this.hoursService.setDay(id, day, dto, req.user.sub);
  }
}
