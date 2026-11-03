import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CreateUserNoteDto {
  @ApiProperty({ example: 'کاربر درخواست تغییر اشتراک داشت' })
  @Transform(trim)
  @IsString()
  @IsNotEmpty({ message: 'متن یادداشت نمی‌تواند خالی باشد' })
  @MaxLength(2000)
  content: string;
}

export class UpdateUserNoteDto extends CreateUserNoteDto {}

export class UserNoteAuthorDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ nullable: true })
  fullName: string | null;
}

export class UserNoteResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  content: string;

  @ApiProperty({ type: UserNoteAuthorDto, nullable: true })
  author: UserNoteAuthorDto | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
