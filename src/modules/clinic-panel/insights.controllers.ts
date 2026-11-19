import { Body, Controller, Get, Post, Query, Res } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import ExcelJS from 'exceljs';
import type { Response } from 'express';
import { ClinicAnalyticsService } from './clinic-analytics.service';
import { ClinicPermission } from './clinic-panel.constants';
import {
  ClinicPanel,
  CurrentClinic,
  RequirePermission,
} from './clinic-panel.guard';
import type { ClinicContext } from './clinic-panel.guard';
import { ClinicRegistrationService } from './clinic-registration.service';
import { RegisterClinicDto } from './dto/registration.dto';
import { DashboardQueryDto, ReportRangeDto } from './dto/reports.dto';

const STATUS_LABELS: Record<string, string> = {
  pending: 'در انتظار پرداخت',
  success: 'موفق',
  failed: 'ناموفق',
  refunded: 'بازگشت وجه',
};

@ApiTags('Clinic Dashboard')
@ClinicPanel()
@Controller('clinic/dashboard')
export class ClinicDashboardController {
  constructor(private readonly analyticsService: ClinicAnalyticsService) {}

  @Get()
  @ApiOperation({
    summary:
      "Today's overview, items needing action, today's schedule and charts. Sections the member lacks permission for are null.",
  })
  get(@CurrentClinic() ctx: ClinicContext, @Query() query: DashboardQueryDto) {
    return this.analyticsService.dashboard(ctx, query);
  }
}

@ApiTags('Clinic Reports')
@ClinicPanel()
@Controller('clinic/reports')
export class ClinicReportsController {
  constructor(private readonly analyticsService: ClinicAnalyticsService) {}

  @Get('financial')
  @RequirePermission(ClinicPermission.FINANCE_VIEW)
  @ApiOperation({
    summary: 'Revenue, trend, by service/vet and recent payments',
  })
  financial(
    @CurrentClinic() ctx: ClinicContext,
    @Query() query: ReportRangeDto,
  ) {
    return this.analyticsService.financialReport(ctx, query);
  }

  @Get('financial/export')
  @RequirePermission(ClinicPermission.FINANCE_VIEW)
  @ApiOperation({ summary: 'Payments in the range as an .xlsx file' })
  async exportFinancial(
    @CurrentClinic() ctx: ClinicContext,
    @Query() query: ReportRangeDto,
    @Res() res: Response,
  ) {
    const { range, rows } = await this.analyticsService.financialExport(
      ctx,
      query,
    );

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Payments');
    sheet.columns = [
      { header: 'کد تراکنش', key: 'code', width: 16 },
      { header: 'تاریخ', key: 'date', width: 14 },
      { header: 'پرداخت‌کننده', key: 'payer', width: 24 },
      { header: 'خدمت', key: 'service', width: 24 },
      { header: 'مبلغ نهایی (تومان)', key: 'amount', width: 18 },
      { header: 'کارمزد', key: 'fee', width: 12 },
      { header: 'بازگشتی', key: 'refunded', width: 12 },
      { header: 'وضعیت', key: 'status', width: 14 },
      { header: 'روش پرداخت', key: 'method', width: 14 },
      { header: 'درگاه', key: 'gateway', width: 14 },
    ];
    for (const p of rows) {
      sheet.addRow({
        code: `TX-${p.number}`,
        date: (p.paidAt ?? p.createdAt).toISOString().slice(0, 10),
        payer: p.user?.fullName ?? '',
        service: p.reservation?.serviceName ?? '',
        amount: p.finalAmount,
        fee: p.gatewayFee,
        refunded: p.refundedAmount,
        status: STATUS_LABELS[p.status] ?? p.status,
        method: p.method,
        gateway: p.gateway ?? '',
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="financial-${range.from}_${range.to}.xlsx"`,
    );
    await workbook.xlsx.write(res);
    res.end();
  }

  @Get('reservations')
  @RequirePermission(ClinicPermission.REPORTS_VIEW)
  @ApiOperation({
    summary: 'Reservation volume, status distribution and top services',
  })
  reservations(
    @CurrentClinic() ctx: ClinicContext,
    @Query() query: ReportRangeDto,
  ) {
    return this.analyticsService.reservationsReport(ctx, query);
  }
}

@ApiTags('Clinic Registration')
@Controller('clinic/register')
export class ClinicRegistrationController {
  constructor(
    private readonly registrationService: ClinicRegistrationService,
  ) {}

  @Post()
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Register a clinic and its manager (first verify the phone via auth/register/send-otp and verify-otp)',
  })
  register(@Body() dto: RegisterClinicDto) {
    return this.registrationService.register(dto);
  }
}
