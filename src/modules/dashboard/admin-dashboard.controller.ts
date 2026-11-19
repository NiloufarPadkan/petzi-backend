import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiPropertyOptional, ApiTags } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { DashboardService } from './dashboard.service';
import type { DashboardPeriod } from './dashboard.service';

class DashboardQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d', '1y'], default: '30d' })
  @IsOptional()
  @IsIn(['7d', '30d', '90d', '1y'])
  period: DashboardPeriod = '30d';
}

@ApiTags('Admin Dashboard')
@AdminOnly()
@Controller('admin/dashboard')
export class AdminDashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary:
      'Cards, reservation overview, growth series, province map, recent activity and open issues',
  })
  get(@Query() query: DashboardQueryDto) {
    return this.dashboardService.getDashboard(query.period);
  }
}
