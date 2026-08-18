import {
  Injectable,
  UnauthorizedException,
  ExecutionContext,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }

  handleRequest<T>(err: Error, user: T): T {
    if (err || !user) {
      throw err || new UnauthorizedException('دسترسی غیرمجاز');
    }
    return user;
  }
}

@Injectable()
export class GoogleAuthGuard extends AuthGuard('google') {}
