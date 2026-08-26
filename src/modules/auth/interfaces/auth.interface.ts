import { Request } from 'express';
import { UserRole } from '../../../common/enums/user-role.enum';

export interface JwtPayload {
  sub: string;
  phoneNumber?: string;
  role: UserRole;
  type: 'access';
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
