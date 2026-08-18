import { ExecutionContext, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Reflector } from '@nestjs/core';
import {
  InjectThrottlerOptions,
  InjectThrottlerStorage,
  ThrottlerGuard,
} from '@nestjs/throttler';

@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  constructor(
    @InjectThrottlerOptions() options: unknown,
    @InjectThrottlerStorage() storageService: unknown,
    reflector: Reflector,
    private readonly configService: ConfigService,
  ) {
    super(
      options as ConstructorParameters<typeof ThrottlerGuard>[0],
      storageService as ConstructorParameters<typeof ThrottlerGuard>[1],
      reflector,
    );
  }

  protected async shouldSkip(context: ExecutionContext): Promise<boolean> {
    if (this.configService.get<string>('nodeEnv') === 'development') {
      return true;
    }
    return super.shouldSkip(context);
  }
}
