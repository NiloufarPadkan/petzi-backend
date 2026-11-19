import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { DevicePlatform } from '../../../common/enums/owner-app.enums';
import { toBoolean } from '../../../common/utils/transform';

export class QueryNotificationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Only unread notifications' })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;
}

export class RegisterDeviceDto {
  @ApiProperty({ description: 'Push token from FCM/APNs/web push' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(500)
  token: string;

  @ApiProperty({ enum: DevicePlatform })
  @IsEnum(DevicePlatform)
  platform: DevicePlatform;
}

export class UpdateNotificationSettingsDto {
  @ApiPropertyOptional({ description: 'Reservation updates' })
  @IsOptional()
  @IsBoolean()
  reservationAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  vaccineReminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  medicationReminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  checkupReminders?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  paymentAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  discountAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  messageAlerts?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  newsletter?: boolean;
}
