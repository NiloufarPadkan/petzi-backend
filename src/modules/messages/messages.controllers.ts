import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  QueryConversationsDto,
  SendMessageDto,
  StartConversationDto,
} from './dto/message.dto';
import { MessagesService } from './messages.service';

@ApiTags('Admin Messages')
@AdminOnly()
@Controller('admin/messages/conversations')
export class AdminMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: 'Conversations, most recent first' })
  findAll(@Query() query: QueryConversationsDto) {
    return this.messagesService.findConversations(query);
  }

  @Post()
  @ApiOperation({ summary: 'Message a user (starts a conversation if needed)' })
  start(@Body() dto: StartConversationDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.startConversation(
      dto.userId,
      dto.body,
      req.user.sub,
    );
  }

  @Get(':id/messages')
  @ApiOperation({ summary: 'Messages (newest first); page 1 marks as read' })
  messages(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.messagesService.findMessages(id, query);
  }

  @Post(':id/messages')
  send(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SendMessageDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.messagesService.sendAsAdmin(id, dto.body, req.user.sub);
  }

  @Delete(':id/messages/:messageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeMessage(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('messageId', ParseUUIDPipe) messageId: string,
  ) {
    return this.messagesService.removeMessage(id, messageId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  removeConversation(@Param('id', ParseUUIDPipe) id: string) {
    return this.messagesService.removeConversation(id);
  }
}

@ApiTags('Messages')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('messages')
export class UserMessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Get()
  @ApiOperation({ summary: "The signed-in user's support conversation" })
  mine(@Query() query: PaginationQueryDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.findMine(req.user.sub, query);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message to support' })
  send(@Body() dto: SendMessageDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.sendAsUser(req.user.sub, dto.body);
  }
}
