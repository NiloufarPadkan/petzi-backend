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
import { PaginationQueryDto } from '../../common/dto/pagination-query.dto';
import { FavoriteType } from '../../common/enums/owner-app.enums';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import {
  AvailabilityQueryDto,
  FavoriteDto,
  QueryClinicsDto,
  QueryVetsDto,
} from './dto/providers.dto';
import { ProvidersService } from './providers.service';

@ApiTags('Providers')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('providers')
export class ProvidersController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get('vets')
  @ApiOperation({
    summary:
      'Vets: search, filter by rating/price/city, sort by rating/reviews/price/distance',
  })
  vets(@Req() req: AuthenticatedRequest, @Query() query: QueryVetsDto) {
    return this.providersService.listVets(req.user.sub, query);
  }

  @Get('vets/:id')
  @ApiOperation({
    summary:
      'Vet detail: services, hours, rating, next free slot, location and share link',
  })
  vet(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.providersService.getVet(req.user.sub, id);
  }

  @Get('vets/:id/reviews')
  vetReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.providersService.vetReviews(id, query);
  }

  @Get('vets/:id/availability')
  @ApiOperation({ summary: 'Free appointment slots per day' })
  availability(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: AvailabilityQueryDto,
  ) {
    return this.providersService.vetAvailability(id, query);
  }

  @Get('vets/:id/share')
  shareVet(@Param('id', ParseUUIDPipe) id: string) {
    return this.providersService.share(FavoriteType.VET, id);
  }

  @Get('clinics')
  clinics(@Req() req: AuthenticatedRequest, @Query() query: QueryClinicsDto) {
    return this.providersService.listClinics(req.user.sub, query);
  }

  @Get('clinics/:id')
  @ApiOperation({ summary: 'Clinic detail with its vets and next free slots' })
  clinic(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.providersService.getClinic(req.user.sub, id);
  }

  @Get('clinics/:id/reviews')
  clinicReviews(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: PaginationQueryDto,
  ) {
    return this.providersService.clinicReviews(id, query);
  }

  @Get('clinics/:id/share')
  shareClinic(@Param('id', ParseUUIDPipe) id: string) {
    return this.providersService.share(FavoriteType.CLINIC, id);
  }

  @Get('frequent')
  @ApiOperation({ summary: 'Vets this owner visited most often' })
  frequent(@Req() req: AuthenticatedRequest) {
    return this.providersService.frequent(req.user.sub);
  }
}

@ApiTags('Favorites')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly providersService: ProvidersService) {}

  @Get()
  list(@Req() req: AuthenticatedRequest) {
    return this.providersService.listFavorites(req.user.sub);
  }

  @Post()
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  add(@Req() req: AuthenticatedRequest, @Body() dto: FavoriteDto) {
    return this.providersService.addFavorite(req.user.sub, dto);
  }

  @Delete(':type/:providerId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiNoContentResponse()
  remove(
    @Req() req: AuthenticatedRequest,
    @Param('type', new ParseEnumPipe(FavoriteType)) type: FavoriteType,
    @Param('providerId', ParseUUIDPipe) providerId: string,
  ) {
    return this.providersService.removeFavorite(req.user.sub, type, providerId);
  }
}
