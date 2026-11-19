import { applyDecorators, UseGuards } from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../modules/auth/guards/auth.guards';
import { RolesGuard } from '../guards/roles.guard';
import { Roles } from './roles.decorator';
import { UserRole } from '../enums/user-role.enum';

/** JWT + admin role guard, with the Swagger bearer marker. */
export const AdminOnly = () =>
  applyDecorators(
    ApiBearerAuth('JWT'),
    UseGuards(JwtAuthGuard, RolesGuard),
    Roles(UserRole.ADMIN),
  );
