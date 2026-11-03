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
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
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
import {
  QueryVetReviewsDto,
  ReplyToVetReviewDto,
  SetVetReviewStatusDto,
  VetReviewListResponseDto,
  VetReviewResponseDto,
  VetReviewSummaryDto,
} from './dto/vet-review.dto';
import { VetReviewsService } from './vet-reviews.service';

@ApiTags('Admin Vets')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@ApiParam({ name: 'id', description: 'Vet (user) UUID' })
@Controller('admin/vets/:id/reviews')
export class AdminVetReviewsController {
  constructor(private readonly reviewsService: VetReviewsService) {}

  @Get()
  @ApiOperation({ summary: 'List reviews (newest first)' })
  @ApiOkResponse({ type: VetReviewListResponseDto })
  findAll(
    @Param('id', ParseUUIDPipe) id: string,
    @Query() query: QueryVetReviewsDto,
  ) {
    return this.reviewsService.findAll(id, query);
  }

  @Get('summary')
  @ApiOperation({ summary: 'Average rating, review count and satisfaction' })
  @ApiOkResponse({ type: VetReviewSummaryDto })
  getSummary(@Param('id', ParseUUIDPipe) id: string) {
    return this.reviewsService.getSummary(id);
  }

  @Put(':reviewId/reply')
  @ApiOperation({ summary: 'Reply to a review (replaces an earlier reply)' })
  @ApiParam({ name: 'reviewId', description: 'Review UUID' })
  @ApiOkResponse({ type: VetReviewResponseDto })
  reply(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: ReplyToVetReviewDto,
  ) {
    return this.reviewsService.reply(id, reviewId, dto.reply);
  }

  @Patch(':reviewId/status')
  @ApiOperation({ summary: 'Approve or reject a review' })
  @ApiParam({ name: 'reviewId', description: 'Review UUID' })
  @ApiOkResponse({ type: VetReviewResponseDto })
  setStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
    @Body() dto: SetVetReviewStatusDto,
  ) {
    return this.reviewsService.setStatus(id, reviewId, dto.status);
  }

  @Delete(':reviewId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a review' })
  @ApiParam({ name: 'reviewId', description: 'Review UUID' })
  @ApiNoContentResponse()
  remove(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('reviewId', ParseUUIDPipe) reviewId: string,
  ) {
    return this.reviewsService.remove(id, reviewId);
  }
}
