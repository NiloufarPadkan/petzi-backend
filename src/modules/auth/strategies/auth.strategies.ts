import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { Strategy as GoogleOAuthStrategy } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UsersService } from '../../users/users.service';
import { JwtPayload } from '../interfaces/auth.interface';

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usersService: UsersService,
  ) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: configService.get<string>('jwt.secret')!,
    });
  }

  async validate(payload: JwtPayload): Promise<JwtPayload> {
    if (payload.type !== 'access') {
      throw new UnauthorizedException('توکن دسترسی نامعتبر است');
    }
    const user = await this.usersService.findById(payload.sub);
    if (!user) {
      throw new UnauthorizedException('کاربر این توکن دیگر وجود ندارد');
    }
    return { ...payload, role: user.role };
  }
}

@Injectable()
export class GoogleStrategy extends PassportStrategy(
  GoogleOAuthStrategy,
  'google',
) {
  constructor(configService: ConfigService) {
    super({
      clientID: configService.get<string>('google.clientId')!,
      clientSecret: configService.get<string>('google.clientSecret')!,
      callbackURL: configService.get<string>('google.callbackUrl')!,
      scope: ['email', 'profile'],
    });
  }

  validate(
    _accessToken: string,
    _refreshToken: string,
    profile: {
      id: string;
      emails: { value: string }[];
      displayName: string;
      photos: { value: string }[];
      _json?: { email_verified?: boolean };
    },
  ) {
    return {
      googleId: profile.id,
      email: profile.emails?.[0]?.value,
      emailVerified: profile._json?.email_verified === true,
      fullName: profile.displayName,
      profilePictureUrl: profile.photos?.[0]?.value,
    };
  }
}
