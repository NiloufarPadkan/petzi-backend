import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApprovalStatus } from '../../../common/enums/approval-status.enum';
import { trim } from '../../../common/utils/transform';

export class QueryVetReviewsDto {
  @ApiPropertyOptional({ enum: ApprovalStatus })
  @IsOptional()
  @IsEnum(ApprovalStatus)
  status?: ApprovalStatus;

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({ default: 10, minimum: 1, maximum: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 10;
}

export class ReplyToVetReviewDto {
  @ApiProperty({ example: 'سپاس از لطف شما' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'متن پاسخ نمی‌تواند خالی باشد' })
  @MaxLength(2000)
  reply: string;
}

export class SetVetReviewStatusDto {
  @ApiProperty({ enum: ApprovalStatus })
  @IsEnum(ApprovalStatus)
  status: ApprovalStatus;
}

export class VetReviewAuthorDto {
  @ApiProperty() id: string;
  @ApiProperty({ nullable: true }) fullName: string | null;
  @ApiProperty({ nullable: true }) profilePictureUrl: string | null;
}

export class VetReviewResponseDto {
  @ApiProperty() id: string;
  @ApiProperty({ minimum: 1, maximum: 5 }) rating: number;
  @ApiProperty() comment: string;
  @ApiProperty({ nullable: true }) reply: string | null;
  @ApiProperty({ nullable: true }) repliedAt: Date | null;
  @ApiProperty({ enum: ApprovalStatus }) status: ApprovalStatus;
  @ApiProperty({ type: VetReviewAuthorDto, nullable: true })
  author: VetReviewAuthorDto | null;
  @ApiProperty() createdAt: Date;
}

export class VetReviewListResponseDto {
  @ApiProperty({ type: [VetReviewResponseDto] }) items: VetReviewResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
}

export class VetReviewSummaryDto {
  @ApiProperty({ example: 4.8 }) averageRating: number;
  @ApiProperty({ example: 285 }) totalReviews: number;
  @ApiProperty({ example: 96 }) satisfactionPercent: number;
  @ApiProperty({ example: 3 }) pendingReviews: number;
}
