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
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { trim } from '../../../common/utils/transform';

export class UploadVetDocumentDto {
  @ApiProperty({ example: 'کارت نظام دامپزشکی' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'عنوان مدرک الزامی است' })
  @MaxLength(150)
  title: string;
}

export class SetVetDocumentStatusDto {
  @ApiProperty({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;

  @ApiPropertyOptional({ description: 'Shown to the vet when rejecting' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(1000)
  reason?: string;
}

export class RejectVetDocumentsDto {
  @ApiProperty({ example: 'کارت نظام خوانا نیست' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'پیام برای دامپزشک الزامی است' })
  @MaxLength(1000)
  message: string;

  @ApiPropertyOptional({
    description:
      'Reserved: SMS/e-mail delivery is not wired up yet, so the message is only stored as the rejection reason',
  })
  @IsOptional()
  @IsBoolean()
  notifyVet?: boolean;
}

export class VetDocumentResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() title: string;
  @ApiProperty() originalName: string;
  @ApiProperty({ description: 'Admin download URL' }) fileUrl: string;
  @ApiProperty() mimeType: string;
  @ApiProperty() sizeBytes: number;
  @ApiProperty({ enum: ApprovalStatus }) status: ApprovalStatus;
  @ApiProperty({ nullable: true }) rejectionReason: string | null;
  @ApiProperty({ description: 'Upload date' }) createdAt: Date;
}
