import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { OrganizationKind } from '../../common/enums/admin-panel.enums';
import {
  IMAGE_MAX_BYTES,
  LOGO_MAX_BYTES,
  clinicImageUploadOptions,
  saveClinicImage,
} from '../clinics/clinic-media';
import {
  AnimalDto,
  ChangeOrganizationStatusDto,
  CreateOrganizationDto,
  QueryOrganizationsDto,
  ServiceItemDto,
  SetCategoriesDto,
  SetShiftsDto,
  UpdateAnimalDto,
  UpdateOrganizationDto,
  UpdateServiceItemDto,
} from './dto/organization.dto';
import { OrganizationsService } from './organizations.service';

const FILE_BODY = {
  schema: {
    type: 'object',
    properties: { file: { type: 'string', format: 'binary' } },
  },
};

/** Routes shared by petshops and shelters; subclasses only set the prefix. */
abstract class BaseOrganizationsController {
  protected abstract readonly kind: OrganizationKind;

  constructor(protected readonly organizationsService: OrganizationsService) {}

  @Get()
  @ApiOperation({ summary: 'List accounts' })
  findAll(@Query() query: QueryOrganizationsDto) {
    return this.organizationsService.findAll(this.kind, query);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Totals for the list header' })
  stats() {
    return this.organizationsService.getStats(this.kind);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.findOne(this.kind, id);
  }

  @Post()
  @ApiOperation({
    summary: 'Create an account (manager signs in by phone OTP)',
  })
  create(@Body() dto: CreateOrganizationDto) {
    return this.organizationsService.create(this.kind, dto);
  }

  @Patch(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateOrganizationDto,
  ) {
    return this.organizationsService.update(this.kind, id, dto);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Approve/reject, activate/suspend' })
  changeStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ChangeOrganizationStatusDto,
  ) {
    return this.organizationsService.changeStatus(this.kind, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.remove(this.kind, id);
  }

  @Post(':id/logo')
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(
    FileInterceptor('file', clinicImageUploadOptions(LOGO_MAX_BYTES)),
  )
  async uploadLogo(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.organizationsService.getOrThrow(this.kind, id);
    return this.organizationsService.setLogo(
      this.kind,
      id,
      await saveClinicImage(file),
    );
  }

  @Delete(':id/logo')
  deleteLogo(@Param('id', ParseUUIDPipe) id: string) {
    return this.organizationsService.setLogo(this.kind, id, null);
  }

  @Post(':id/photos')
  @ApiConsumes('multipart/form-data')
  @ApiBody(FILE_BODY)
  @UseInterceptors(
    FileInterceptor('file', clinicImageUploadOptions(IMAGE_MAX_BYTES)),
  )
  async uploadPhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    await this.organizationsService.getOrThrow(this.kind, id);
    return this.organizationsService.addPhoto(
      this.kind,
      id,
      await saveClinicImage(file),
    );
  }

  @Delete(':id/photos/:index')
  deletePhoto(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('index', ParseIntPipe) index: number,
  ) {
    return this.organizationsService.removePhoto(this.kind, id, index);
  }

  @Put(':id/shifts')
  @ApiOperation({ summary: 'Replace the weekly working shifts' })
  setShifts(@Param('id', ParseUUIDPipe) id: string, @Body() dto: SetShiftsDto) {
    return this.organizationsService.setShifts(this.kind, id, dto.shifts);
  }

  @Post(':id/services')
  addService(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ServiceItemDto,
  ) {
    return this.organizationsService.addService(this.kind, id, dto);
  }

  @Patch(':id/services/:itemId')
  updateService(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
    @Body() dto: UpdateServiceItemDto,
  ) {
    return this.organizationsService.updateService(this.kind, id, itemId, dto);
  }

  @Delete(':id/services/:itemId')
  removeService(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('itemId', ParseUUIDPipe) itemId: string,
  ) {
    return this.organizationsService.removeService(this.kind, id, itemId);
  }
}

@ApiTags('Admin Petshops')
@AdminOnly()
@Controller('admin/petshops')
export class AdminPetshopsController extends BaseOrganizationsController {
  protected readonly kind = OrganizationKind.PETSHOP;

  @Put(':id/categories')
  @ApiOperation({ summary: 'Replace the product categories' })
  setCategories(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: SetCategoriesDto,
  ) {
    return this.organizationsService.setCategories(
      this.kind,
      id,
      dto.categories,
    );
  }
}

@ApiTags('Admin Shelters')
@AdminOnly()
@Controller('admin/shelters')
export class AdminSheltersController extends BaseOrganizationsController {
  protected readonly kind = OrganizationKind.SHELTER;

  @Post(':id/animals')
  addAnimal(@Param('id', ParseUUIDPipe) id: string, @Body() dto: AnimalDto) {
    return this.organizationsService.addAnimal(this.kind, id, dto, null);
  }

  @Patch(':id/animals/:animalId')
  updateAnimal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('animalId', ParseUUIDPipe) animalId: string,
    @Body() dto: UpdateAnimalDto,
  ) {
    return this.organizationsService.updateAnimal(this.kind, id, animalId, dto);
  }

  @Delete(':id/animals/:animalId')
  removeAnimal(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('animalId', ParseUUIDPipe) animalId: string,
  ) {
    return this.organizationsService.removeAnimal(this.kind, id, animalId);
  }
}
