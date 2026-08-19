import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerModule } from '@nestjs/throttler';
import { AppThrottlerGuard } from './common/guards/app-throttler.guard';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import configuration from './config/configuration';
import { validateEnvironment } from './config/environment.validation';
import { AuthModule } from './modules/auth/auth.module';
import { PetsModule } from './modules/pets/pets.module';
import { AddressesModule } from './modules/addresses/addresses.module';
import { User } from './modules/users/entities/user.entity';
import { Otp } from './modules/otp/entities/otp.entity';
import { Pet } from './modules/pets/entities/pet.entity';
import { PetVaccine } from './modules/pets/entities/pet-vaccine.entity';
import { PetDocument } from './modules/pets/entities/pet-document.entity';
import { Address } from './modules/addresses/entities/address.entity';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnvironment,
    }),
    TypeOrmModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        type: 'postgres',
        host: configService.get<string>('database.host'),
        port: configService.get<number>('database.port'),
        username: configService.get<string>('database.username'),
        password: configService.get<string>('database.password'),
        database: configService.get<string>('database.database'),
        entities: [User, Otp, Pet, PetVaccine, PetDocument, Address],
        synchronize: configService.get<boolean>('database.synchronize'),
        logging: configService.get<string>('nodeEnv') === 'development',
      }),
    }),
    ThrottlerModule.forRoot([
      {
        ttl: 60_000,
        limit: 100,
      },
    ]),
    AuthModule,
    PetsModule,
    AddressesModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_GUARD,
      useClass: AppThrottlerGuard,
    },
  ],
})
export class AppModule {}
