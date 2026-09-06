import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import * as bcrypt from 'bcrypt';
import { QueryFailedError } from 'typeorm';
import { OtpPurpose } from '../../common/enums/otp-purpose.enum';
import { OneTimeTokenPurpose } from '../../common/enums/one-time-token-purpose.enum';
import {
  isNormalizedIranianMobile,
  normalizePhoneNumber,
} from '../../common/validators/is-iranian-phone.validator';
import { IsStrongPasswordConstraint } from '../../common/validators/is-strong-password.validator';
import { OtpService } from '../otp/otp.service';
import { SmsService } from '../sms/sms.service';
import { UsersService } from '../users/users.service';
import { User } from '../users/entities/user.entity';
import { UserRole } from '../../common/enums/user-role.enum';
import { RegisterDto } from './dto/register.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { JwtPayload } from './interfaces/auth.interface';
import { OneTimeTokenService } from './one-time-token.service';

interface RegistrationTokenPayload {
  sub: string;
  jti: string;
  purpose: 'register';
  type: 'registration';
}

@Injectable()
export class AuthService {
  private readonly passwordValidator = new IsStrongPasswordConstraint();

  constructor(
    private readonly usersService: UsersService,
    private readonly otpService: OtpService,
    private readonly smsService: SmsService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly oneTimeTokenService: OneTimeTokenService,
  ) {}

  async sendRegisterOtp(phoneNumber: string) {
    const normalized = normalizePhoneNumber(phoneNumber);

    const existing = await this.usersService.findByPhone(normalized);
    if (existing) {
      return this.buildOtpSentResponse();
    }

    const code = await this.sendOtpWithCooldown(
      normalized,
      OtpPurpose.REGISTER,
    );
    return this.buildOtpSentResponse(code);
  }

  async verifyRegisterOtp(phoneNumber: string, code: string) {
    const normalized = normalizePhoneNumber(phoneNumber);

    const existing = await this.usersService.findByPhone(normalized);
    if (existing) {
      throw new ConflictException('این شماره موبایل قبلاً ثبت شده است');
    }

    const valid = await this.otpService.verifyOtp(
      normalized,
      code,
      OtpPurpose.REGISTER,
    );
    if (!valid) {
      throw new BadRequestException('کد تأیید نامعتبر یا منقضی شده است');
    }

    const expiresIn = this.configService.get<number>(
      'otp.registrationTokenExpiresInSeconds',
    )!;
    const { jti } = await this.oneTimeTokenService.issue({
      purpose: OneTimeTokenPurpose.REGISTER,
      expiresInSeconds: expiresIn,
      phoneNumber: normalized,
    });

    const registrationToken = this.jwtService.sign(
      {
        sub: normalized,
        jti,
        purpose: 'register',
        type: 'registration',
      } satisfies RegistrationTokenPayload,
      { expiresIn },
    );

    return {
      message: 'شماره موبایل تأیید شد',
      registrationToken,
      expiresIn,
    };
  }

  async register(dto: RegisterDto, profilePictureUrl?: string) {
    const normalized = normalizePhoneNumber(dto.phoneNumber);
    const normalizedEmail = dto.email.trim().toLowerCase();

    if (!this.passwordValidator.validate(dto.password)) {
      throw new BadRequestException(this.passwordValidator.defaultMessage());
    }

    if (new Date(`${dto.dateOfBirth}T00:00:00.000Z`) > new Date()) {
      throw new BadRequestException('تاریخ تولد نمی‌تواند در آینده باشد');
    }

    const existingPhone = await this.usersService.findByPhone(normalized);
    if (existingPhone) {
      throw new ConflictException('این شماره موبایل قبلاً ثبت شده است');
    }

    const existingEmail = await this.usersService.findByEmail(normalizedEmail);
    if (existingEmail) {
      throw new ConflictException('این ایمیل قبلاً ثبت شده است');
    }

    await this.consumeRegistrationToken(dto.registrationToken, normalized);

    const hashed = await bcrypt.hash(dto.password, 12);

    let user: User;
    try {
      user = await this.usersService.create({
        phoneNumber: normalized,
        fullName: dto.fullName,
        email: normalizedEmail,
        dateOfBirth: dto.dateOfBirth,
        password: hashed,
        profilePictureUrl,
        isPhoneVerified: true,
      });
    } catch (error) {
      if (this.isUniqueConstraintError(error)) {
        throw new ConflictException('شماره موبایل یا ایمیل قبلاً ثبت شده است');
      }
      throw error;
    }

    return this.buildAuthResponse(user, 'ثبت‌نام با موفقیت انجام شد');
  }

  async sendLoginOtp(phoneNumber: string) {
    const normalized = normalizePhoneNumber(phoneNumber);

    const user = await this.usersService.findByPhone(normalized);
    if (!user) {
      return this.buildOtpSentResponse();
    }

    const code = await this.sendOtpWithCooldown(normalized, OtpPurpose.LOGIN);
    return this.buildOtpSentResponse(code);
  }

  async verifyLoginOtp(phoneNumber: string, code: string) {
    const normalized = normalizePhoneNumber(phoneNumber);

    const user = await this.usersService.findByPhone(normalized);
    if (!user) {
      throw new NotFoundException('کاربری با این شماره موبایل یافت نشد');
    }

    const valid = await this.otpService.verifyOtp(
      normalized,
      code,
      OtpPurpose.LOGIN,
    );

    if (!valid) {
      throw new BadRequestException('کد تأیید نامعتبر یا منقضی شده است');
    }

    return this.buildAuthResponse(user, 'ورود با موفقیت انجام شد');
  }

  async adminLogin(dto: AdminLoginDto) {
    const user = await this.usersService.findByUsernameWithPassword(
      dto.username,
    );

    if (
      !user ||
      user.role !== UserRole.ADMIN ||
      !user.password ||
      !(await bcrypt.compare(dto.password, user.password))
    ) {
      throw new UnauthorizedException('نام کاربری یا رمز عبور نادرست است');
    }

    return this.buildAuthResponse(user, 'ورود با موفقیت انجام شد');
  }

  async handleGoogleLogin(googleUser: {
    googleId: string;
    email?: string;
    emailVerified?: boolean;
    fullName?: string;
    profilePictureUrl?: string;
  }) {
    const normalizedEmail = googleUser.email?.trim().toLowerCase();
    let user = await this.usersService.findByGoogleId(googleUser.googleId);

    if (!user && !googleUser.emailVerified) {
      throw new BadRequestException('ایمیل حساب گوگل تأیید نشده است');
    }

    if (!user && normalizedEmail) {
      const existingEmailUser =
        await this.usersService.findByEmail(normalizedEmail);
      if (existingEmailUser) {
        throw new ConflictException(
          'این ایمیل قبلاً ثبت شده است؛ ابتدا وارد حساب شوید و سپس گوگل را متصل کنید',
        );
      }
    }

    if (!user) {
      user = await this.usersService.create({
        googleId: googleUser.googleId,
        email: normalizedEmail,
        fullName: googleUser.fullName,
        profilePictureUrl: googleUser.profilePictureUrl,
        phoneNumber: `google_${googleUser.googleId}`,
        isEmailVerified: true,
      });
    }

    const expiresIn = this.configService.get<number>(
      'otp.googleExchangeExpiresInSeconds',
    )!;
    const { jti } = await this.oneTimeTokenService.issue({
      purpose: OneTimeTokenPurpose.GOOGLE_EXCHANGE,
      expiresInSeconds: expiresIn,
      userId: user.id,
    });

    return { exchangeCode: jti, expiresIn };
  }

  async exchangeGoogleCode(code: string) {
    const token = await this.oneTimeTokenService.consume(
      code,
      OneTimeTokenPurpose.GOOGLE_EXCHANGE,
    );
    if (!token?.userId) {
      throw new BadRequestException('کد تبادل گوگل نامعتبر یا منقضی شده است');
    }

    const user = await this.usersService.findById(token.userId);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    return this.buildAuthResponse(user, 'ورود با گوگل موفقیت‌آمیز بود');
  }

  buildFrontendRedirectUrl(params: Record<string, string>): string {
    const base =
      this.configService.get<string>('frontend.redirectUrl') ??
      'http://localhost:5173/auth/callback';
    const url = new URL(base);
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
    return url.toString();
  }

  async getProfile(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }
    return this.sanitizeUser(user);
  }

  async updateProfile(userId: string, dto: UpdateProfileDto) {
    if (
      dto.fullName === undefined &&
      dto.email === undefined &&
      dto.dateOfBirth === undefined
    ) {
      throw new BadRequestException('حداقل یک فیلد باید ارسال شود');
    }

    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const changes: Partial<User> = {};

    if (dto.fullName !== undefined) {
      changes.fullName = dto.fullName;
    }

    if (dto.dateOfBirth !== undefined) {
      if (new Date(`${dto.dateOfBirth}T00:00:00.000Z`) > new Date()) {
        throw new BadRequestException('تاریخ تولد نمی‌تواند در آینده باشد');
      }
      changes.dateOfBirth = dto.dateOfBirth;
    }

    if (dto.email !== undefined) {
      const normalizedEmail = dto.email.trim().toLowerCase();
      if (normalizedEmail !== user.email) {
        const existingEmail =
          await this.usersService.findByEmail(normalizedEmail);
        if (existingEmail) {
          throw new ConflictException('این ایمیل قبلاً ثبت شده است');
        }
        changes.email = normalizedEmail;
        changes.isEmailVerified = false;
      }
    }

    let updated = user;
    if (Object.keys(changes).length > 0) {
      try {
        updated = await this.usersService.update(userId, changes);
      } catch (error) {
        if (this.isUniqueConstraintError(error)) {
          throw new ConflictException('این ایمیل قبلاً ثبت شده است');
        }
        throw error;
      }
    }

    return this.sanitizeUser(updated);
  }

  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (!user.password) {
      throw new BadRequestException(
        'این حساب رمز عبور ندارد؛ از ورود با گوگل استفاده کنید',
      );
    }

    const currentPasswordValid = await bcrypt.compare(
      dto.currentPassword,
      user.password,
    );
    if (!currentPasswordValid) {
      throw new UnauthorizedException('رمز عبور فعلی نادرست است');
    }

    const sameAsOld = await bcrypt.compare(dto.newPassword, user.password);
    if (sameAsOld) {
      throw new BadRequestException(
        'رمز عبور جدید نمی‌تواند با رمز عبور فعلی یکسان باشد',
      );
    }

    const hashed = await bcrypt.hash(dto.newPassword, 12);
    await this.usersService.update(userId, { password: hashed });

    return { message: 'رمز عبور با موفقیت تغییر کرد' };
  }

  async sendDeleteAccountOtp(userId: string) {
    const user = await this.usersService.findById(userId);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    if (!isNormalizedIranianMobile(user.phoneNumber)) {
      throw new BadRequestException(
        'ارسال کد حذف برای این حساب ممکن نیست؛ از تأیید گوگل استفاده کنید',
      );
    }

    const code = await this.sendOtpWithCooldown(
      user.phoneNumber,
      OtpPurpose.DELETE_ACCOUNT,
    );
    return this.buildOtpSentResponse(code);
  }

  async deleteAccount(userId: string, dto: DeleteAccountDto) {
    const user = await this.usersService.findByIdWithPassword(userId);
    if (!user) {
      throw new NotFoundException('کاربر یافت نشد');
    }

    const steppedUp = await this.verifyDeleteStepUp(user, dto);
    if (!steppedUp) {
      throw new UnauthorizedException(
        'برای حذف حساب، رمز عبور، کد تأیید یا تأیید گوگل لازم است',
      );
    }

    await this.usersService.softDeleteAccount(user);

    return { message: 'حساب کاربری با موفقیت حذف شد' };
  }

  private async verifyDeleteStepUp(
    user: User,
    dto: DeleteAccountDto,
  ): Promise<boolean> {
    if (user.password) {
      if (dto.currentPassword) {
        return bcrypt.compare(dto.currentPassword, user.password);
      }
      if (dto.code && isNormalizedIranianMobile(user.phoneNumber)) {
        return this.otpService.verifyOtp(
          user.phoneNumber,
          dto.code,
          OtpPurpose.DELETE_ACCOUNT,
        );
      }
      return false;
    }

    // Google-only: require a fresh Google exchange code (not the access JWT alone).
    if (dto.googleExchangeCode) {
      const token = await this.oneTimeTokenService.consume(
        dto.googleExchangeCode,
        OneTimeTokenPurpose.GOOGLE_EXCHANGE,
      );
      return !!token?.userId && token.userId === user.id;
    }

    if (dto.code && isNormalizedIranianMobile(user.phoneNumber)) {
      return this.otpService.verifyOtp(
        user.phoneNumber,
        dto.code,
        OtpPurpose.DELETE_ACCOUNT,
      );
    }

    return false;
  }

  private async consumeRegistrationToken(
    registrationToken: string,
    expectedPhone: string,
  ): Promise<void> {
    let payload: RegistrationTokenPayload;
    try {
      payload = this.jwtService.verify<RegistrationTokenPayload>(
        registrationToken,
      );
    } catch {
      throw new BadRequestException('توکن ثبت‌نام نامعتبر یا منقضی شده است');
    }

    if (
      payload.type !== 'registration' ||
      payload.purpose !== 'register' ||
      payload.sub !== expectedPhone ||
      !payload.jti
    ) {
      throw new BadRequestException('توکن ثبت‌نام نامعتبر است');
    }

    const consumed = await this.oneTimeTokenService.consume(
      payload.jti,
      OneTimeTokenPurpose.REGISTER,
    );
    if (!consumed || consumed.phoneNumber !== expectedPhone) {
      throw new BadRequestException('توکن ثبت‌نام نامعتبر یا قبلاً استفاده شده است');
    }
  }

  private async sendOtpWithCooldown(
    phoneNumber: string,
    purpose: OtpPurpose,
  ): Promise<string> {
    try {
      const code = await this.otpService.createOtp(phoneNumber, purpose);
      try {
        await this.smsService.sendOtp(phoneNumber, code);
      } catch (smsError) {
        await this.otpService.invalidateActiveOtps(phoneNumber, purpose);
        throw smsError;
      }
      return code;
    } catch (error) {
      if (
        error instanceof Error &&
        error.message.startsWith('RESEND_COOLDOWN:')
      ) {
        const waitSeconds = error.message.split(':')[1];
        throw new BadRequestException(
          `لطفاً ${waitSeconds} ثانیه دیگر برای ارسال مجدد کد صبر کنید`,
        );
      }
      throw error;
    }
  }

  private signToken(payload: JwtPayload, expiresIn: string): string {
    return this.jwtService.sign(payload, {
      expiresIn: expiresIn as `${number}d` | `${number}m` | `${number}h`,
    });
  }

  private buildAuthResponse(user: User, message: string) {
    const accessToken = this.signToken(
      { sub: user.id, role: user.role, type: 'access' },
      this.configService.get<string>('jwt.expiresIn')!,
    );

    return {
      message,
      accessToken,
      user: this.sanitizeUser(user),
    };
  }

  private sanitizeUser(user: User) {
    const safeUser: Partial<User> = { ...user };
    delete safeUser.password;
    return safeUser as Omit<User, 'password'>;
  }

  private buildOtpSentResponse(code?: string) {
    const isDev = this.configService.get<string>('nodeEnv') === 'development';

    return {
      message:
        isDev && code
          ? 'کد تأیید ارسال شد'
          : 'اگر شماره واجد شرایط باشد، کد تأیید ارسال می‌شود',
      expiresIn: this.configService.get<number>('otp.expiresInSeconds'),
      ...(isDev && code ? { code } : {}),
    };
  }

  private isUniqueConstraintError(error: unknown): boolean {
    if (!(error instanceof QueryFailedError)) return false;
    const driverError = error.driverError as { code?: string };
    return driverError.code === '23505';
  }
}
