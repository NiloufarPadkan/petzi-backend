import { ConfigService } from '@nestjs/config';
import { createHmac } from 'node:crypto';
import { Repository } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { Otp } from './entities/otp.entity';
import { OtpService } from './otp.service';

describe('OtpService', () => {
  const secret = 'test-secret';
  const hash = (code: string) =>
    createHmac('sha256', secret).update(code).digest('hex');

  const createRepository = () => ({
    findOne: jest.fn(),
    update: jest.fn(),
    create: jest.fn((value: Partial<Otp>) => value as Otp),
    save: jest.fn((value: Otp) => Promise.resolve(value)),
  });

  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        'otp.resendCooldownSeconds': 60,
        'otp.expiresInSeconds': 120,
        'jwt.secret': secret,
      };
      return values[key];
    }),
  };

  it('stores a hash instead of the plain OTP code', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue(null);
    repository.update.mockResolvedValue({ affected: 0 });
    const service = new OtpService(
      repository as unknown as Repository<Otp>,
      configService as unknown as ConfigService,
    );

    const code = await service.createOtp('09123456789', OtpPurpose.LOGIN);

    expect(code).toMatch(/^\d{6}$/);
    expect(repository.create).toHaveBeenCalledWith(
      expect.objectContaining({
        codeHash: hash(code),
        phoneNumber: '09123456789',
        purpose: OtpPurpose.LOGIN,
      }),
    );
    expect(repository.create).not.toHaveBeenCalledWith(
      expect.objectContaining({ code }),
    );
  });

  it('increments failed attempts for an invalid code', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      id: 'otp-id',
      codeHash: hash('1234'),
      failedAttempts: 0,
      isUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    repository.update.mockResolvedValue({ affected: 1 });
    const service = new OtpService(
      repository as unknown as Repository<Otp>,
      configService as unknown as ConfigService,
    );

    await expect(
      service.verifyOtp('09123456789', '9999', OtpPurpose.LOGIN),
    ).resolves.toBe(false);
    expect(repository.update).toHaveBeenCalledWith(
      { id: 'otp-id', isUsed: false },
      { failedAttempts: 1, isUsed: false },
    );
  });

  it('only succeeds when the unused OTP is atomically consumed', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      id: 'otp-id',
      codeHash: hash('1234'),
      failedAttempts: 0,
      isUsed: false,
      expiresAt: new Date(Date.now() + 60_000),
    });
    repository.update.mockResolvedValue({ affected: 0 });
    const service = new OtpService(
      repository as unknown as Repository<Otp>,
      configService as unknown as ConfigService,
    );

    await expect(
      service.verifyOtp('09123456789', '1234', OtpPurpose.LOGIN),
    ).resolves.toBe(false);
  });

  it('enforces resend cooldown against used OTPs as well', async () => {
    const repository = createRepository();
    repository.findOne.mockResolvedValue({
      id: 'otp-id',
      isUsed: true,
      createdAt: new Date(),
    });
    const service = new OtpService(
      repository as unknown as Repository<Otp>,
      configService as unknown as ConfigService,
    );
    // production path enforces cooldown
    configService.get.mockImplementation((key: string) => {
      const values: Record<string, string | number> = {
        nodeEnv: 'production',
        'otp.resendCooldownSeconds': 60,
        'otp.expiresInSeconds': 120,
        'jwt.secret': secret,
      };
      return values[key];
    });

    await expect(
      service.createOtp('09123456789', OtpPurpose.LOGIN),
    ).rejects.toThrow(/RESEND_COOLDOWN:/);
  });

  it('invalidates active unused OTPs', async () => {
    const repository = createRepository();
    repository.update.mockResolvedValue({ affected: 1 });
    const service = new OtpService(
      repository as unknown as Repository<Otp>,
      configService as unknown as ConfigService,
    );

    await service.invalidateActiveOtps('09123456789', OtpPurpose.REGISTER);

    expect(repository.update).toHaveBeenCalledWith(
      { phoneNumber: '09123456789', purpose: OtpPurpose.REGISTER, isUsed: false },
      { isUsed: true },
    );
  });
});
