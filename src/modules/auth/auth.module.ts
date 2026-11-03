import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { UsersModule } from '../users/users.module';
import { OtpModule } from '../otp/otp.module';
import { SmsModule } from '../sms/sms.module';
import { GoogleStrategy, JwtStrategy } from './strategies/auth.strategies';
import { OneTimeToken } from './entities/one-time-token.entity';
import { OneTimeTokenService } from './one-time-token.service';

@Module({
  imports: [
    UsersModule,
    OtpModule,
    SmsModule,
    TypeOrmModule.forFeature([OneTimeToken]),
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get<string>('jwt.secret')!,
        signOptions: {
          expiresIn: configService.get<string>(
            'jwt.expiresIn',
          )! as `${number}d`,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [AuthService, OneTimeTokenService, JwtStrategy, GoogleStrategy],
  exports: [AuthService],
})
export class AuthModule {}
