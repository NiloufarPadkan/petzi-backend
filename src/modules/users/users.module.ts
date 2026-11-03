import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Address } from '../addresses/entities/address.entity';
import { Pet } from '../pets/entities/pet.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { AdminUserNotesController } from './admin-user-notes.controller';
import { AdminUserNotesService } from './admin-user-notes.service';
import { AdminUsersService } from './admin-users.service';
import { UserNote } from './entities/user-note.entity';
import { User } from './entities/user.entity';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([User, Pet, Address, Subscription, UserNote]),
    SubscriptionsModule,
  ],
  controllers: [UsersController, AdminUserNotesController],
  providers: [UsersService, AdminUsersService, AdminUserNotesService],
  exports: [UsersService],
})
export class UsersModule {}
