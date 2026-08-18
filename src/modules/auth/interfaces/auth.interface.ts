import { Request } from 'express';

export interface JwtPayload {
  sub: string;
  phoneNumber?: string;
  type: 'access';
}

export interface AuthenticatedRequest extends Request {
  user: JwtPayload;
}
