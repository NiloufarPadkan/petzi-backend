import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  StreamableFile,
  UseGuards,
} from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiProduces,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { createReadStream } from 'node:fs';
import { access } from 'node:fs/promises';
import { join } from 'node:path';
import { Roles } from '../../common/decorators/roles.decorator';
import { PetStatus } from '../../common/enums/pet-status.enum';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { CreatePetDto, UpdatePetDto } from './dto/update-pet.dto';
import {
  PetDeleteResponseDto,
  PetResponseDto,
  PetUpdateResponseDto,
} from './dto/pet-response.dto';
import { PetsService } from './pets.service';

@ApiTags('Admin Pets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'userId', description: 'Pet owner UUID' })
@Controller('admin/users/:userId/pets')
export class AdminPetsController {
  constructor(private readonly petsService: PetsService) {}

  @Get()
  @ApiOperation({ summary: "List a pet owner's pets" })
  @ApiQuery({ name: 'status', enum: PetStatus, required: false })
  @ApiOkResponse({ type: [PetResponseDto] })
  findAll(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Query('status', new ParseEnumPipe(PetStatus, { optional: true }))
    status?: PetStatus,
  ) {
    return this.petsService.adminFindAll(userId, status);
  }

  @Post()
  @ApiOperation({
    summary: 'Add a pet to a pet owner',
    description:
      'Creates an active pet in one step. Same schema as PATCH /pets/{id}; the required submit fields (name, type, gender, birthDate|approximateAge, weight, height, healthStatus, vaccinationStatus, foodType, mealsPerDay) must be present.',
  })
  @ApiCreatedResponse({ type: PetResponseDto })
  create(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Body() dto: CreatePetDto,
  ) {
    return this.petsService.adminCreate(userId, dto);
  }

  @Get(':petId')
  @ApiOperation({ summary: "Get one of a pet owner's pets" })
  @ApiParam({ name: 'petId', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetResponseDto })
  findOne(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.petsService.adminFindOne(userId, petId);
  }

  @Patch(':petId')
  @ApiOperation({ summary: 'Update a pet (draft or active)' })
  @ApiParam({ name: 'petId', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetUpdateResponseDto })
  update(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Body() dto: UpdatePetDto,
  ) {
    return this.petsService.adminUpdate(userId, petId, dto);
  }

  @Delete(':petId')
  @ApiOperation({ summary: 'Delete a pet (draft or active)' })
  @ApiParam({ name: 'petId', description: 'Pet UUID' })
  @ApiOkResponse({ type: PetDeleteResponseDto })
  remove(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('petId', ParseUUIDPipe) petId: string,
  ) {
    return this.petsService.adminRemove(userId, petId);
  }

  @Get(':petId/documents/:documentId/download')
  @ApiOperation({ summary: 'Download a pet document' })
  @ApiParam({ name: 'petId', description: 'Pet UUID' })
  @ApiParam({ name: 'documentId', description: 'Document UUID' })
  @ApiProduces(
    'application/pdf',
    'image/png',
    'image/jpeg',
    'image/gif',
    'image/webp',
  )
  @ApiOkResponse({ description: 'Document file stream' })
  async downloadDocument(
    @Param('userId', ParseUUIDPipe) userId: string,
    @Param('petId', ParseUUIDPipe) petId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const document = await this.petsService.adminGetDocument(
      userId,
      petId,
      documentId,
    );
    const path = join(process.cwd(), document.fileUrl.replace(/^[/\\]+/, ''));
    try {
      await access(path);
    } catch {
      throw new NotFoundException('فایل روی سرور یافت نشد');
    }

    response.set({
      'Content-Type': document.mimeType,
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(document.originalName)}`,
    });

    return new StreamableFile(createReadStream(path));
  }
}
