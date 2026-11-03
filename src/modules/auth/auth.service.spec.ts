import {
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { OneTimeTokenPurpose } from '../../common/enums/one-time-token-purpose.enum';
import { AuthService } from './auth.service';
import { OtpService } from '../otp/otp.service';
import { SmsService } from '../sms/sms.service';
import { UsersService } from '../users/users.service';
import { OneTimeTokenService } from './one-time-token.service';
import { UserRole } from '../../common/enums/user-role.enum';

describe('AuthService registration token flow', () => {
  const usersService = {
    findByPhone: jest.fn(),
    findByEmail: jest.fn(),
    create: jest.fn(),
  };
  const otpService = {
    verifyOtp: jest.fn(),
    createOtp: jest.fn(),
    invalidateActiveOtps: jest.fn(),
  };
  const smsService = {
    sendOtp: jest.fn(),
  };
  const jwtService = {
    sign: jest.fn().mockReturnValue('signed-registration-token'),
    verify: jest.fn(),
  };
  const configService = {
    get: jest.fn((key: string) => {
      const values: Record<string, string | number> = {
        'otp.registrationTokenExpiresInSeconds': 900,
        'otp.expiresInSeconds': 120,
        'otp.googleExchangeExpiresInSeconds': 120,
        'jwt.expiresIn': '7d',
        nodeEnv: 'test',
      };
      return values[key];
    }),
  };
  const oneTimeTokenService = {
    issue: jest.fn().mockResolvedValue({ jti: 'jti-1', expiresAt: new Date() }),
    consume: jest.fn(),
  };

  const service = new AuthService(
    usersService as unknown as UsersService,
    otpService as unknown as OtpService,
    smsService as unknown as SmsService,
    jwtService as unknown as JwtService,
    configService as unknown as ConfigService,
    oneTimeTokenService as unknown as OneTimeTokenService,
  );

  beforeEach(() => {
    jest.clearAllMocks();
    oneTimeTokenService.issue.mockResolvedValue({
      jti: 'jti-1',
      expiresAt: new Date(),
    });
    jwtService.sign.mockReturnValue('signed-registration-token');
  });

  it('verifyRegisterOtp consumes OTP and returns a registration token', async () => {
    usersService.findByPhone.mockResolvedValue(null);
    otpService.verifyOtp.mockResolvedValue(true);

    const result = await service.verifyRegisterOtp('09123456789', '123456');

    expect(otpService.verifyOtp).toHaveBeenCalledWith(
      '09123456789',
      '123456',
      OtpPurpose.REGISTER,
    );
    expect(oneTimeTokenService.issue).toHaveBeenCalledWith(
      expect.objectContaining({
        purpose: OneTimeTokenPurpose.REGISTER,
        phoneNumber: '09123456789',
        expiresInSeconds: 900,
      }),
    );
    expect(result.registrationToken).toBe('signed-registration-token');
    expect(result.expiresIn).toBe(900);
  });

  it('register rejects when registration token jti cannot be consumed', async () => {
    usersService.findByPhone.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    jwtService.verify.mockReturnValue({
      sub: '09123456789',
      jti: 'jti-1',
      purpose: 'register',
      type: 'registration',
    });
    oneTimeTokenService.consume.mockResolvedValue(null);

    await expect(
      service.register({
        phoneNumber: '09123456789',
        registrationToken: 'token',
        fullName: 'Ali',
        email: 'ali@example.com',
        dateOfBirth: '1990-01-15',
        password: 'SecurePass1!',
      }),
    ).rejects.toBeInstanceOf(BadRequestException);

    expect(usersService.create).not.toHaveBeenCalled();
  });

  it('register creates the user after consuming a valid registration token', async () => {
    usersService.findByPhone.mockResolvedValue(null);
    usersService.findByEmail.mockResolvedValue(null);
    jwtService.verify.mockReturnValue({
      sub: '09123456789',
      jti: 'jti-1',
      purpose: 'register',
      type: 'registration',
    });
    oneTimeTokenService.consume.mockResolvedValue({
      phoneNumber: '09123456789',
      purpose: OneTimeTokenPurpose.REGISTER,
    });
    usersService.create.mockResolvedValue({
      id: 'user-1',
      phoneNumber: '09123456789',
      fullName: 'Ali',
      email: 'ali@example.com',
      role: UserRole.USER,
    });

    const result = await service.register({
      phoneNumber: '09123456789',
      registrationToken: 'token',
      fullName: 'Ali',
      email: 'ali@example.com',
      dateOfBirth: '1990-01-15',
      password: 'SecurePass1!',
    });

    expect(oneTimeTokenService.consume).toHaveBeenCalledWith(
      'jti-1',
      OneTimeTokenPurpose.REGISTER,
    );
    expect(usersService.create).toHaveBeenCalled();
    expect(result.accessToken).toBeDefined();
  });

  it('invalidates OTP when SMS send fails', async () => {
    usersService.findByPhone.mockResolvedValue(null);
    otpService.createOtp.mockResolvedValue('123456');
    smsService.sendOtp.mockRejectedValue(new Error('sms down'));

    await expect(service.sendRegisterOtp('09123456789')).rejects.toThrow(
      'sms down',
    );
    expect(otpService.invalidateActiveOtps).toHaveBeenCalledWith(
      '09123456789',
      OtpPurpose.REGISTER,
    );
  });

  it('verifyRegisterOtp rejects when phone is already registered', async () => {
    usersService.findByPhone.mockResolvedValue({ id: 'existing' });

    await expect(
      service.verifyRegisterOtp('09123456789', '123456'),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(otpService.verifyOtp).not.toHaveBeenCalled();
  });
});
