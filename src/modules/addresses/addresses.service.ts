import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { Address } from './entities/address.entity';
import { CreateAddressDto } from './dto/create-address.dto';
import { UpdateAddressDto } from './dto/update-address.dto';

const MAX_ADDRESSES_PER_USER = 10;

@Injectable()
export class AddressesService {
  constructor(
    @InjectRepository(Address)
    private readonly addressesRepository: Repository<Address>,
    private readonly dataSource: DataSource,
  ) {}

  async findAllByUser(userId: string): Promise<Address[]> {
    return this.addressesRepository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async create(userId: string, dto: CreateAddressDto): Promise<Address> {
    const count = await this.addressesRepository.count({ where: { userId } });
    if (count >= MAX_ADDRESSES_PER_USER) {
      throw new UnprocessableEntityException(
        'حداکثر تعداد آدرس مجاز ثبت شده است.',
      );
    }

    const isFirstAddress = count === 0;
    const isDefault = isFirstAddress ? true : (dto.isDefault ?? false);

    return this.dataSource.transaction(async (manager) => {
      if (isDefault) {
        await manager.update(
          Address,
          { userId, isDefault: true },
          { isDefault: false },
        );
      }
      const address = manager.create(Address, {
        userId,
        title: dto.title,
        city: dto.city,
        fullAddress: dto.fullAddress,
        latitude: dto.latitude,
        longitude: dto.longitude,
        isDefault,
      });
      return manager.save(address);
    });
  }

  async update(
    userId: string,
    addressId: string,
    dto: UpdateAddressDto,
  ): Promise<Address> {
    if (
      dto.title === undefined &&
      dto.city === undefined &&
      dto.fullAddress === undefined &&
      dto.latitude === undefined &&
      dto.longitude === undefined &&
      dto.isDefault === undefined
    ) {
      throw new BadRequestException('حداقل یک فیلد باید ارسال شود.');
    }

    const address = await this.getOwnedAddress(userId, addressId);

    if (dto.isDefault === false && address.isDefault) {
      const otherCount = await this.addressesRepository.count({
        where: { userId },
      });
      if (otherCount <= 1) {
        throw new BadRequestException(
          'حداقل یک آدرس باید به عنوان پیش‌فرض انتخاب شده باشد.',
        );
      }
    }

    const willBeDefault = dto.isDefault ?? address.isDefault;

    return this.dataSource.transaction(async (manager) => {
      if (dto.isDefault === true && !address.isDefault) {
        await manager.update(
          Address,
          { userId, isDefault: true },
          { isDefault: false },
        );
      }

      Object.assign(address, {
        ...(dto.title !== undefined ? { title: dto.title } : {}),
        ...(dto.city !== undefined ? { city: dto.city } : {}),
        ...(dto.fullAddress !== undefined
          ? { fullAddress: dto.fullAddress }
          : {}),
        ...(dto.latitude !== undefined ? { latitude: dto.latitude } : {}),
        ...(dto.longitude !== undefined ? { longitude: dto.longitude } : {}),
        isDefault: willBeDefault,
      });

      return manager.save(address);
    });
  }

  async remove(userId: string, addressId: string): Promise<void> {
    const address = await this.getOwnedAddress(userId, addressId);

    await this.dataSource.transaction(async (manager) => {
      await manager.remove(address);

      if (address.isDefault) {
        const nextDefault = await manager.findOne(Address, {
          where: { userId },
          order: { createdAt: 'DESC' },
        });
        if (nextDefault) {
          await manager.update(
            Address,
            { id: nextDefault.id },
            { isDefault: true },
          );
        }
      }
    });
  }

  async setDefault(userId: string, addressId: string): Promise<Address> {
    const address = await this.getOwnedAddress(userId, addressId);

    if (address.isDefault) {
      return address;
    }

    return this.dataSource.transaction(async (manager) => {
      await manager.update(
        Address,
        { userId, isDefault: true },
        { isDefault: false },
      );
      await manager.update(Address, { id: addressId }, { isDefault: true });
      return manager.findOneOrFail(Address, { where: { id: addressId } });
    });
  }

  private async getOwnedAddress(
    userId: string,
    addressId: string,
  ): Promise<Address> {
    const address = await this.addressesRepository.findOne({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundException('آدرس یافت نشد.');
    }
    if (address.userId !== userId) {
      throw new ForbiddenException('این آدرس متعلق به شما نیست.');
    }
    return address;
  }
}
