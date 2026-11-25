import {
  BadRequestException,
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
  ParseIntPipe,
  Req,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { imageUploadOptions, saveImage } from '../../common/utils/image-upload';
import { decodeMultipartFilename } from '../../common/utils/multipart-filename';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
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
import type { TicketAttachment } from './entities/support-ticket.entity';
import {
  ATTACHMENT_MAX_BYTES,
  MAX_TICKET_ATTACHMENTS,
  SUPPORT_ATTACHMENT_DIRECTORY,
} from './support.constants';
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
  @ApiOperation({
    summary: 'Open a support ticket (report a problem)',
    description:
      'Send JSON, or multipart/form-data to attach up to 5 images (JPG, PNG, WEBP; 5MB each) in the `images` field.',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['subject', 'description'],
      properties: {
        subject: { type: 'string' },
        category: { type: 'string', example: 'payment' },
        description: { type: 'string' },
        priority: { type: 'string', enum: ['low', 'normal', 'high'] },
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor(
      'images',
      MAX_TICKET_ATTACHMENTS,
      imageUploadOptions(ATTACHMENT_MAX_BYTES),
    ),
  )
  async create(
    @Body() dto: CreateTicketDto,
    @Req() req: AuthenticatedRequest,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    const attachments = await this.storeAttachments(files);
    try {
      return await this.supportService.createTicket(
        dto,
        req.user.sub,
        attachments,
      );
    } catch (error) {
      await removeUploadUrls(attachments.map((a) => a.url));
      throw error;
    }
  }

  @Get('tickets/:id')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'One of my tickets, with the support reply' })
  mineOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.supportService.findMyTicket(req.user.sub, id);
  }

  @Post('tickets/:id/attachments')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Add images to my open ticket (5 attachments in total)',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['images'],
      properties: {
        images: { type: 'array', items: { type: 'string', format: 'binary' } },
      },
    },
  })
  @UseInterceptors(
    FilesInterceptor(
      'images',
      MAX_TICKET_ATTACHMENTS,
      imageUploadOptions(ATTACHMENT_MAX_BYTES),
    ),
  )
  async addAttachments(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files?: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('حداقل یک تصویر ارسال کنید');
    }
    // 404 for someone else's ticket before anything is written to disk.
    await this.supportService.findMyTicket(req.user.sub, id);
    const attachments = await this.storeAttachments(files);
    try {
      return await this.supportService.addAttachments(
        req.user.sub,
        id,
        attachments,
      );
    } catch (error) {
      await removeUploadUrls(attachments.map((a) => a.url));
      throw error;
    }
  }

  @Delete('tickets/:id/attachments/:index')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Remove one attachment from my ticket' })
  removeAttachment(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.supportService.removeAttachment(req.user.sub, id, index);
  }

  @Get('tickets')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: "The signed-in user's tickets" })
  mine(@Req() req: AuthenticatedRequest) {
    return this.supportService.findMyTickets(req.user.sub);
  }

  /** Verifies and stores each image; a failure leaves no files behind. */
  private async storeAttachments(
    files?: Express.Multer.File[],
  ): Promise<TicketAttachment[]> {
    const stored: TicketAttachment[] = [];
    try {
      for (const file of files ?? []) {
        stored.push({
          url: await saveImage(file, SUPPORT_ATTACHMENT_DIRECTORY),
          name: decodeMultipartFilename(file.originalname).slice(0, 200),
          mimeType: file.mimetype,
          sizeBytes: file.size,
        });
      }
      return stored;
    } catch (error) {
      await removeUploadUrls(stored.map((a) => a.url));
      throw error;
    }
  }
}
