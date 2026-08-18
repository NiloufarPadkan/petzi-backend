import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);

  constructor(private readonly configService: ConfigService) {}

  sendOtp(phoneNumber: string, code: string): Promise<void> {
    const provider = this.configService.get<string>('sms.provider');

    if (provider === 'mock') {
      if (this.configService.get<string>('nodeEnv') === 'production') {
        this.logger.error('Mock SMS provider cannot be used in production');
        throw new ServiceUnavailableException('سرویس پیامک پیکربندی نشده است');
      }
      this.logger.log(`[MOCK SMS] OTP ${code} sent to ${phoneNumber}`);
      return Promise.resolve();
    }

    this.logger.error(`SMS provider "${provider}" is not implemented`);
    throw new ServiceUnavailableException('سرویس پیامک در دسترس نیست');
  }
}
