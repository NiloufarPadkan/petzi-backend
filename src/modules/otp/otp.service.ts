import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { createHmac, randomInt, timingSafeEqual } from 'crypto';
import { MoreThan, Repository } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { Otp } from './entities/otp.entity';

@Injectable()
export class OtpService {
  private static readonly MAX_VERIFY_ATTEMPTS = 5;

  constructor(
    @InjectRepository(Otp)
    private readonly otpRepository: Repository<Otp>,
    private readonly configService: ConfigService,
  ) {}

  async createOtp(phoneNumber: string, purpose: OtpPurpose): Promise<string> {
    const isDev = this.configService.get<string>('nodeEnv') === 'development';
    const cooldown = this.configService.get<number>(
      'otp.resendCooldownSeconds',
    )!;

    if (!isDev) {
      await this.enforceResendCooldown(phoneNumber, purpose, cooldown);
    }

    await this.otpRepository.update(
      { phoneNumber, purpose, isUsed: false },
      { isUsed: true },
    );

    const code = this.generateCode();
    const expiresIn = this.configService.get<number>('otp.expiresInSeconds')!;

    const otp = this.otpRepository.create({
      phoneNumber,
      codeHash: this.hashCode(code),
      purpose,
      expiresAt: new Date(Date.now() + expiresIn * 1000),
    });

    await this.otpRepository.save(otp);
    return code;
  }

  private async enforceResendCooldown(
    phoneNumber: string,
    purpose: OtpPurpose,
    cooldown: number,
  ): Promise<void> {
    // Count used and unused OTPs so exhausting failed attempts cannot bypass cooldown.
    const recentOtp = await this.otpRepository.findOne({
      where: {
        phoneNumber,
        purpose,
        createdAt: MoreThan(new Date(Date.now() - cooldown * 1000)),
      },
      order: { createdAt: 'DESC' },
    });

    if (recentOtp) {
      const waitSeconds = Math.ceil(
        (recentOtp.createdAt.getTime() + cooldown * 1000 - Date.now()) / 1000,
      );
      throw new Error(`RESEND_COOLDOWN:${waitSeconds}`);
    }
  }

  /** Marks all unused OTPs for this phone+purpose as used (e.g. after SMS send failure). */
  async invalidateActiveOtps(
    phoneNumber: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    await this.otpRepository.update(
      { phoneNumber, purpose, isUsed: false },
      { isUsed: true },
    );
  }

  async verifyOtp(
    phoneNumber: string,
    code: string,
    purpose: OtpPurpose,
  ): Promise<boolean> {
    const otp = await this.otpRepository.findOne({
      where: { phoneNumber, purpose, isUsed: false },
      order: { createdAt: 'DESC' },
    });

    if (!otp) return false;
    if (
      otp.expiresAt < new Date() ||
      otp.failedAttempts >= OtpService.MAX_VERIFY_ATTEMPTS
    ) {
      await this.otpRepository.update(
        { id: otp.id, isUsed: false },
        { isUsed: true },
      );
      return false;
    }

    const suppliedCode = Buffer.from(this.hashCode(code), 'hex');
    const storedCode = Buffer.from(otp.codeHash, 'hex');
    const matches =
      suppliedCode.length === storedCode.length &&
      timingSafeEqual(suppliedCode, storedCode);

    if (!matches) {
      const failedAttempts = otp.failedAttempts + 1;
      await this.otpRepository.update(
        { id: otp.id, isUsed: false },
        {
          failedAttempts,
          isUsed: failedAttempts >= OtpService.MAX_VERIFY_ATTEMPTS,
        },
      );
      return false;
    }

    const result = await this.otpRepository.update(
      { id: otp.id, isUsed: false },
      { isUsed: true },
    );
    return result.affected === 1;
  }

  private generateCode(): string {
    return randomInt(100_000, 1_000_000).toString();
  }

  private hashCode(code: string): string {
    const secret = this.configService.get<string>('jwt.secret')!;
    return createHmac('sha256', secret).update(code).digest('hex');
  }
}
