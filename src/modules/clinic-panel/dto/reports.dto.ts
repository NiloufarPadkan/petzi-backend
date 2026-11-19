import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

export class DashboardQueryDto {
  @ApiPropertyOptional({ enum: ['7d', '30d', '90d'], default: '7d' })
  @IsOptional()
  @IsIn(['7d', '30d', '90d'])
  range: '7d' | '30d' | '90d' = '7d';
}

export class ReportRangeDto {
  @ApiPropertyOptional({
    example: '2026-11-01',
    description: 'Tehran date; defaults to 30 days before `to`',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    example: '2026-11-30',
    description: 'Tehran date; defaults to today',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
