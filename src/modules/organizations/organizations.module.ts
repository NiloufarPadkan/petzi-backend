import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UsersModule } from '../users/users.module';
import {
  AdminPetshopsController,
  AdminSheltersController,
} from './admin-organizations.controller';
import { Organization } from './entities/organization.entity';
import { OrganizationsService } from './organizations.service';

@Module({
  imports: [TypeOrmModule.forFeature([Organization]), UsersModule],
  controllers: [AdminPetshopsController, AdminSheltersController],
  providers: [OrganizationsService],
})
export class OrganizationsModule {}
