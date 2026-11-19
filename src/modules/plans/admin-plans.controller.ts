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
} from '@nestjs/common';
import {
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import {
  CreatePlanDto,
  PlanResponseDto,
  PlansOverviewDto,
  QueryPlansDto,
  UpdatePlanDto,
} from './dto/plan.dto';
import { PlansService } from './plans.service';

@ApiTags('Admin Premium Plans')
@AdminOnly()
@Controller('admin/plans')
export class AdminPlansController {
  constructor(private readonly plansService: PlansService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Subscription KPIs for the plans page' })
  @ApiOkResponse({ type: PlansOverviewDto })
  getOverview() {
    return this.plansService.getOverview();
  }

  @Get()
  @ApiOperation({ summary: 'List plans with subscriber stats' })
  @ApiOkResponse({ type: [PlanResponseDto] })
  findAll(@Query() query: QueryPlansDto) {
    return this.plansService.findAll(query);
  }

  @Get(':id')
  @ApiOkResponse({ type: PlanResponseDto })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.findOne(id);
  }

  @Post()
  @ApiCreatedResponse({ type: PlanResponseDto })
  create(@Body() dto: CreatePlanDto) {
    return this.plansService.create(dto);
  }

  @Patch(':id')
  @ApiOkResponse({ type: PlanResponseDto })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdatePlanDto) {
    return this.plansService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a plan (blocked while it has subscribers)' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.plansService.remove(id);
  }
}
