import {
  Body,
  Controller,
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
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { BookingsService } from './bookings.service';
import {
  CancelBookingDto,
  CreateBookingDto,
  CreateReviewDto,
  QueryMyReservationsDto,
  ReservationCheckoutDto,
} from './dto/booking.dto';
import { ReservationPaymentsService } from './reservation-payments.service';

@ApiTags('My Reservations')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard)
@Controller('reservations')
export class BookingsController {
  constructor(
    private readonly bookingsService: BookingsService,
    private readonly paymentsService: ReservationPaymentsService,
  ) {}

  @Post()
  @ApiOperation({
    summary:
      'Book a free slot (use the availability endpoint first); starts as pending',
  })
  create(@Req() req: AuthenticatedRequest, @Body() dto: CreateBookingDto) {
    return this.bookingsService.create(req.user.sub, dto);
  }

  @Get()
  @ApiOperation({ summary: 'My reservations: tab=upcoming or past' })
  list(
    @Req() req: AuthenticatedRequest,
    @Query() query: QueryMyReservationsDto,
  ) {
    return this.bookingsService.list(req.user.sub, query);
  }

  @Get(':id')
  findOne(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.findOne(req.user.sub, id);
  }

  @Post(':id/cancel')
  @HttpCode(HttpStatus.OK)
  cancel(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CancelBookingDto,
  ) {
    return this.bookingsService.cancel(req.user.sub, id, dto.reason);
  }

  @Post(':id/checkout')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'Start paying for a reservation; open the returned redirectUrl (dev: sandbox page)',
  })
  checkout(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReservationCheckoutDto,
  ) {
    return this.paymentsService.checkout(req.user.sub, id, dto.gateway);
  }

  @Get(':id/rebook')
  @ApiOperation({ summary: 'Pre-fill data for "reserve again"' })
  rebook(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.rebook(req.user.sub, id);
  }

  @Post(':id/review')
  @ApiOperation({ summary: 'Review a completed visit (shown after approval)' })
  review(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateReviewDto,
  ) {
    return this.bookingsService.review(req.user.sub, id, dto);
  }

  @Get(':id/review')
  getReview(
    @Req() req: AuthenticatedRequest,
    @Param('id', ParseUUIDPipe) id: string,
  ) {
    return this.bookingsService.getReview(req.user.sub, id);
  }
}
