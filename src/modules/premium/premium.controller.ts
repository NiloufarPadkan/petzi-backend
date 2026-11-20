import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  ParseUUIDPipe,
  Post,
  Query,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { CancelSubscriptionDto, CheckoutDto } from './dto/premium.dto';
import { PremiumService } from './premium.service';

@ApiTags('Premium')
@Controller('premium')
export class PremiumController {
  constructor(
    private readonly premiumService: PremiumService,
    private readonly configService: ConfigService,
  ) {}

  @Get('plans')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'Active plans with price per duration option' })
  plans() {
    return this.premiumService.listPlans();
  }

  @Get('me')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({ summary: 'My subscription and days remaining' })
  me(@Req() req: AuthenticatedRequest) {
    return this.premiumService.me(req.user.sub);
  }

  @Get('payments')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  payments(@Req() req: AuthenticatedRequest) {
    return this.premiumService.myPayments(req.user.sub);
  }

  @Post('cancel')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Cancel my subscription now (remaining days are not kept)',
  })
  cancel(@Req() req: AuthenticatedRequest, @Body() dto: CancelSubscriptionDto) {
    return this.premiumService.cancel(req.user.sub, dto.reason);
  }

  @Post('checkout')
  @ApiBearerAuth('JWT')
  @UseGuards(JwtAuthGuard)
  @ApiOperation({
    summary: 'Start buying a plan; open the returned redirectUrl to pay',
  })
  checkout(@Req() req: AuthenticatedRequest, @Body() dto: CheckoutDto) {
    return this.premiumService.checkout(req.user.sub, dto);
  }

  /** Called by the payment gateway when the payer comes back. */
  @Get('callback')
  @Throttle({ default: { limit: 30, ttl: 60_000 } })
  @ApiOperation({ summary: 'Payment gateway return URL (not for the app)' })
  async callback(
    @Query('paymentId', ParseUUIDPipe) paymentId: string,
    @Query('Authority') authority: string | undefined,
    @Query('Status') status: string | undefined,
    @Res() res: Response,
  ) {
    const result = await this.premiumService.handleCallback(
      paymentId,
      authority,
      status,
    );
    const site = this.configService.get<string>('publicSiteUrl');
    if (site) {
      const query = new URLSearchParams({ status: result.status, paymentId });
      res.redirect(
        `${site.replace(/\/$/, '')}/payment/result?${query.toString()}`,
      );
      return;
    }
    res.json(result);
  }
}
