import { Controller, Get, Query, Req, UseGuards } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiPropertyOptional,
  ApiTags,
} from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { trim } from '../../common/utils/transform';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { HomeService } from './home.service';

class HomeQueryDto {
  @ApiPropertyOptional({
    description: 'Pet to summarize; defaults to the first',
  })
  @IsOptional()
  @IsUUID()
  petId?: string;
}

class SearchQueryDto {
  @ApiPropertyOptional({ description: 'At least 2 characters' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(100)
  q: string = '';

  @ApiPropertyOptional({ default: 5, minimum: 1, maximum: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  limit: number = 5;
}

@ApiTags('Home')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller()
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  @Get('home')
  @ApiOperation({
    summary:
      'Home screen: pet summary, things needing attention, upcoming reservations, alerts, activity',
  })
  home(@Req() req: AuthenticatedRequest, @Query() query: HomeQueryDto) {
    return this.homeService.getHome(req.user.sub, query.petId);
  }

  @Get('search')
  @ApiOperation({
    summary: 'Quick-action search across vets, clinics and my pets',
  })
  search(@Req() req: AuthenticatedRequest, @Query() query: SearchQueryDto) {
    return this.homeService.search(req.user.sub, query.q, query.limit);
  }
}
