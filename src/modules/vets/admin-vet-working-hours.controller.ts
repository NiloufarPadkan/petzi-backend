import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Put,
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
import {
  SetVetWorkingDayDto,
  VetWorkingDayResponseDto,
} from './dto/vet-working-hours.dto';
import { VetWorkingHoursService } from './vet-working-hours.service';

@ApiTags('Admin Vets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'Vet (user) UUID' })
@Controller('admin/vets/:id/working-hours')
export class AdminVetWorkingHoursController {
  constructor(private readonly hoursService: VetWorkingHoursService) {}

  @Get()
  @ApiOperation({ summary: "The vet's weekly schedule (7 days)" })
  @ApiOkResponse({ type: [VetWorkingDayResponseDto] })
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.hoursService.findAll(id);
  }

  @Put(':day')
  @ApiOperation({ summary: 'Set the schedule of one weekday' })
  @ApiParam({
    name: 'day',
    description: 'Day of week: 0 = Saturday … 6 = Friday',
  })
  @ApiOkResponse({ type: VetWorkingDayResponseDto })
  setDay(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('day', ParseIntPipe) day: number,
    @Body() dto: SetVetWorkingDayDto,
  ) {
    if (day < 0 || day > 6) {
      throw new BadRequestException('روز هفته باید بین ۰ تا ۶ باشد');
    }
    return this.hoursService.setDay(id, day, dto);
  }
}
