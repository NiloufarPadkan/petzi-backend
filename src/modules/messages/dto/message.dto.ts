import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  MaxLength,
} from 'class-validator';
import { PaginationQueryDto } from '../../../common/dto/pagination-query.dto';
import { UserRole } from '../../../common/enums/user-role.enum';
import { toBoolean, trim } from '../../../common/utils/transform';

export class SendMessageDto {
  @ApiProperty({ example: 'سلام، چطور می‌توانم کمک کنم؟' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'متن پیام نمی‌تواند خالی باشد' })
  @MaxLength(4000)
  body: string;
}

export class StartConversationDto extends SendMessageDto {
  @ApiProperty({ description: 'The user to message' })
  @IsUUID()
  userId: string;
}

export class QueryConversationsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'User name or phone' })
  @IsOptional()
  @Transform(trim)
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: UserRole, description: 'Filter by user type' })
  @IsOptional()
  @IsEnum(UserRole)
  role?: UserRole;

  @ApiPropertyOptional({
    description: 'Only conversations with unread messages',
  })
  @IsOptional()
  @Transform(toBoolean)
  @IsBoolean()
  unreadOnly?: boolean;
}
