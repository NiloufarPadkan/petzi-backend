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
  Req,
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
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { AdminUserNotesService } from './admin-user-notes.service';
import {
  CreateUserNoteDto,
  UpdateUserNoteDto,
  UserNoteResponseDto,
} from './dto/user-note.dto';

@ApiTags('Admin Users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'User UUID' })
@Controller('admin/users/:id/notes')
export class AdminUserNotesController {
  constructor(private readonly notesService: AdminUserNotesService) {}

  @Get()
  @ApiOperation({ summary: "List a user's admin notes (newest first)" })
  @ApiOkResponse({ type: [UserNoteResponseDto] })
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.notesService.findAll(id);
  }

  @Post()
  @ApiOperation({ summary: 'Add a note to a user' })
  @ApiCreatedResponse({ type: UserNoteResponseDto })
  create(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateUserNoteDto,
  ) {
    return this.notesService.create(id, req.user.sub, dto.content);
  }

  @Patch(':noteId')
  @ApiOperation({ summary: 'Edit a note' })
  @ApiParam({ name: 'noteId', description: 'Note UUID' })
  @ApiOkResponse({ type: UserNoteResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
    @Body() dto: UpdateUserNoteDto,
  ) {
    return this.notesService.update(id, noteId, dto.content);
  }

  @Delete(':noteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a note' })
  @ApiParam({ name: 'noteId', description: 'Note UUID' })
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('noteId', ParseUUIDPipe) noteId: string,
  ) {
    return this.notesService.remove(id, noteId);
  }
}
