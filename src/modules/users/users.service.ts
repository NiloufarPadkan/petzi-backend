import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, Repository } from 'typeorm';
import { User } from './entities/user.entity';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly dataSource: DataSource,
  ) {}

  async findByPhone(phoneNumber: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { phoneNumber } });
  }

  async findByUsernameWithPassword(username: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.username = :username', { username })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { email } });
  }

  async findByGoogleId(googleId: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { googleId } });
  }

  async findById(id: string): Promise<User | null> {
    return this.usersRepository.findOne({ where: { id } });
  }

  async findByIdWithPassword(id: string): Promise<User | null> {
    return this.usersRepository
      .createQueryBuilder('user')
      .addSelect('user.password')
      .where('user.id = :id', { id })
      .andWhere('user.deletedAt IS NULL')
      .getOne();
  }

  async create(data: Partial<User>): Promise<User> {
    const user = this.usersRepository.create(data);
    return this.usersRepository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User> {
    await this.usersRepository.update(id, data);
    const user = await this.findById(id);
    if (!user) {
      throw new Error('User not found after update');
    }
    return user;
  }

  async softDeleteAccount(user: User): Promise<void> {
    const suffix = `deleted_${Date.now()}_${user.id}`;

    await this.dataSource.transaction(async (manager) => {
      await manager.update(User, user.id, {
        phoneNumber: `${suffix}_${user.phoneNumber}`,
        email: user.email ? `${suffix}_${user.email}` : user.email,
        googleId: user.googleId ? `${suffix}_${user.googleId}` : user.googleId,
      });
      await manager.softDelete(User, user.id);
    });
  }
}
