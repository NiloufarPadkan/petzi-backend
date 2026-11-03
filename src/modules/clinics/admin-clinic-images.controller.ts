import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { Roles } from '../../common/decorators/roles.decorator';
import { ClinicImageCategory } from '../../common/enums/clinic-enums';
import { UserRole } from '../../common/enums/user-role.enum';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import {
  IMAGE_MAX_BYTES,
  clinicImageUploadOptions,
  saveClinicImage,
} from './clinic-media';
import { ClinicImagesService } from './clinic-images.service';
import {
  UpdateClinicImageDto,
  UploadClinicImageDto,
} from './dto/clinic-image.dto';
import { ClinicImageResponseDto } from './dto/clinic-response.dto';
import { ClinicsService } from './clinics.service';

@ApiTags('Admin Clinics')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'Clinic (user) UUID' })
@Controller('admin/clinics/:id/images')
export class AdminClinicImagesController {
  constructor(
    private readonly imagesService: ClinicImagesService,
    private readonly clinicsService: ClinicsService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Gallery images (newest first)' })
  @ApiQuery({ name: 'category', enum: ClinicImageCategory, required: false })
  @ApiOkResponse({ type: [ClinicImageResponseDto] })
  findAll(
    @Param('id', ParseUUIDPipe) id: string,
    @Query(
      'category',
      new ParseEnumPipe(ClinicImageCategory, { optional: true }),
    )
    category?: ClinicImageCategory,
  ) {
    return this.imagesService.findAll(id, category);
  }

  @Post()
  @ApiOperation({ summary: 'Upload a gallery image (JPG/PNG/WEBP, max 5MB)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['title', 'category', 'file'],
      properties: {
        title: { type: 'string' },
        category: { type: 'string', enum: Object.values(ClinicImageCategory) },
        file: { type: 'string', format: 'binary' },
      },
    },
  })
  @ApiCreatedResponse({ type: ClinicImageResponseDto })
  @UseInterceptors(
    FileInterceptor('file', clinicImageUploadOptions(IMAGE_MAX_BYTES)),
  )
  async upload(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UploadClinicImageDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    await this.clinicsService.getClinicOrThrow(id);
    const fileUrl = await saveClinicImage(file);
    return this.imagesService.create(id, dto.title, dto.category, fileUrl);
  }

  @Patch(':imageId')
  @ApiOperation({ summary: 'Edit an image title or category' })
  @ApiParam({ name: 'imageId', description: 'Image UUID' })
  @ApiOkResponse({ type: ClinicImageResponseDto })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
    @Body() dto: UpdateClinicImageDto,
  ) {
    return this.imagesService.update(id, imageId, dto);
  }

  @Delete(':imageId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a gallery image' })
  @ApiParam({ name: 'imageId', description: 'Image UUID' })
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('imageId', ParseUUIDPipe) imageId: string,
  ) {
    return this.imagesService.remove(id, imageId);
  }
}
