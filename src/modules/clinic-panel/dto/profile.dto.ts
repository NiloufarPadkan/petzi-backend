import { ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsBoolean, IsOptional } from 'class-validator';
import { UpdateClinicDto } from '../../clinics/dto/update-clinic.dto';

/**
 * What a clinic may change about itself. Legal identifiers (license and
 * registration numbers), the login phone number, status and admin notes stay
 * with the admin panel.
 */
export class PanelUpdateClinicDto extends PickType(UpdateClinicDto, [
  'name',
  'type',
  'about',
  'managerName',
  'email',
  'foundedAt',
  'brandColor',
  'phone',
  'secondaryPhone',
  'website',
  'instagram',
  'province',
  'city',
  'postalCode',
  'address',
  'latitude',
  'longitude',
  'acceptsOnlineBooking',
  'isListedInSearch',
  'bookingCutoffHours',
] as const) {}

export class UpdatePanelNotificationsDto {
  @ApiPropertyOptional() @IsOptional() @IsBoolean() liveAlerts?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  reservationReminders?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() patientMessages?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() paymentAlerts?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  cancellationAlerts?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  statusChangeAlerts?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() dailyReports?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() systemWarnings?: boolean;
  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  generalAnnouncements?: boolean;
}
