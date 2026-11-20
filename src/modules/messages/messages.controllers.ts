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
  Sse,
  UseGuards,
} from '@nestjs/common';
import type { MessageEvent } from '@nestjs/common';
import type { Observable } from 'rxjs';
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
  QueryMyMessagesDto,
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

  @Sse('stream')
  @ApiOperation({
    summary: 'Live feed (Server-Sent Events) of every new support message',
  })
  stream(): Observable<MessageEvent> {
    return this.messagesService.streamForAdmin();
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
  @ApiOperation({
    summary: "The signed-in user's support conversation",
    description:
      'Newest first. Pass `after` to get only newer messages (polling). Opening page 1 marks replies as read.',
  })
  mine(@Query() query: QueryMyMessagesDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.findMine(req.user.sub, query);
  }

  @Sse('stream')
  @ApiOperation({
    summary: 'Live chat (Server-Sent Events): new messages as they arrive',
    description:
      'Send the Authorization header. Events: `message` (a chat message) and `ping` (keep-alive). Reconnect and call GET /messages?after=<last createdAt> to catch up.',
  })
  stream(@Req() req: AuthenticatedRequest): Observable<MessageEvent> {
    return this.messagesService.streamForUser(req.user.sub);
  }

  @Get('unread-count')
  @ApiOperation({ summary: 'Support replies I have not opened (badge)' })
  unreadCount(@Req() req: AuthenticatedRequest) {
    return this.messagesService.unreadCountForUser(req.user.sub);
  }

  @Post('read')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Mark the support replies as read' })
  markRead(@Req() req: AuthenticatedRequest) {
    return this.messagesService.markReadForUser(req.user.sub);
  }

  @Post()
  @ApiOperation({ summary: 'Send a message to support' })
  send(@Body() dto: SendMessageDto, @Req() req: AuthenticatedRequest) {
    return this.messagesService.sendAsUser(req.user.sub, dto.body);
  }
}
