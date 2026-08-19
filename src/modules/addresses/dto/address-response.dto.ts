import { ApiProperty } from '@nestjs/swagger';

export class AddressResponseDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  id: string;

  @ApiProperty({ example: 'خانه' })
  title: string;

  @ApiProperty({ example: 'تهران' })
  city: string;

  @ApiProperty({ example: 'خیابان ولیعصر، پلاک ۱۲' })
  fullAddress: string;

  @ApiProperty({ example: 35.6892523 })
  latitude: number;

  @ApiProperty({ example: 51.3889631 })
  longitude: number;

  @ApiProperty({ example: true })
  isDefault: boolean;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
