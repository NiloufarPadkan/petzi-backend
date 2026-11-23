import { Controller, Get, ParseUUIDPipe, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { ReservationPaymentsService } from './reservation-payments.service';

/** Gateway return URL. Public: the payer's browser arrives without a token. */
@ApiTags('My Reservations')
@Controller('reservations/payments')
export class ReservationPaymentsController {
  constructor(private readonly payments: ReservationPaymentsService) {}

  @Get('callback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Payment gateway return URL (not for the app)' })
  async callback(
    @Query('paymentId', ParseUUIDPipe) paymentId: string,
    @Query('Authority') authority: string | undefined,
    @Query('Status') status: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.payments.handleCallback(
      paymentId,
      authority,
      status,
    );
    res.redirect(303, this.payments.resultUrl(result));
  }
}
