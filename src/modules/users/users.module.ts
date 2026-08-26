import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../addresses/entities/address.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminUsersService } from './admin-users.service';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Pet, Address, Subscription]),
    SubscriptionsModule,
  ],
  controllers: [UsersController],
  providers: [UsersService, AdminUsersService],
  exports: [UsersService],
})
export class UsersModule {}
