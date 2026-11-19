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
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { SettingsGroup } from '../../common/enums/admin-panel.enums';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  CreateFaqDto,
  CreateTicketDto,
  QueryFaqDto,
  QueryTicketsDto,
  UpdateFaqDto,
  UpdateTicketDto,
} from './dto/support.dto';
import { SettingsService } from '../settings/settings.service';
import { SupportService } from './support.service';

@ApiTags('Admin Support')
@AdminOnly()
@Controller('admin/support/tickets')
export class AdminTicketsController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  @ApiOperation({ summary: 'List support tickets' })
  findAll(@Query() query: QueryTicketsDto) {
    return this.supportService.findTickets(query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Ticket counts by status' })
  stats() {
    return this.supportService.getTicketStats();
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.findTicket(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Change status/priority or reply to a ticket' })
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateTicketDto) {
    return this.supportService.updateTicket(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.removeTicket(id);
  }
}

@ApiTags('Admin Support')
@AdminOnly()
@Controller('admin/support/faq')
export class AdminFaqController {
  constructor(private readonly supportService: SupportService) {}

  @Get()
  findAll(@Query() query: QueryFaqDto) {
    return this.supportService.findFaq(query);
  }

  @Post()
  create(@Body() dto: CreateFaqDto) {
    return this.supportService.createFaq(dto);
  }

  @Patch(':id')
  update(@Param('id', ParseUUIDPipe) id: string, @Body() dto: UpdateFaqDto) {
    return this.supportService.updateFaq(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.supportService.removeFaq(id);
  }
}

@ApiTags('Support')
@Controller('support')
export class PublicSupportController {
  constructor(
    private readonly supportService: SupportService,
    private readonly settingsService: SettingsService,
  ) {}

  @Get('pages')
  @ApiOperation({
    summary: 'Terms, privacy policy, about text and support contact (public)',
  })
  async pages() {
    const general = await this.settingsService.getGroup(SettingsGroup.GENERAL);
    return {
      terms: general['termsText'],
      privacy: general['privacyText'],
      about: general['aboutText'],
      contact: {
        phone: general['supportPhone'],
        email: general['supportEmail'],
        hours: general['supportHours'],
      },
    };
  }

  @Get('faq')
  @ApiOperation({ summary: 'Published FAQ entries (public)' })
  faq() {
    return this.supportService.findFaq({ isPublished: true });
  }

  @Post('tickets')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Open a support ticket as the signed-in user' })
  create(@Body() dto: CreateTicketDto, @Req() req: AuthenticatedRequest) {
    return this.supportService.createTicket(dto, req.user.sub);
  }

  @Get('tickets')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "The signed-in user's tickets" })
  mine(@Req() req: AuthenticatedRequest) {
    return this.supportService.findMyTickets(req.user.sub);
  }
}
