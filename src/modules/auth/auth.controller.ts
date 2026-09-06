import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpException,
  Patch,
  Post,
  Req,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { Throttle } from '@nestjs/throttler';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import { memoryStorage } from 'multer';
import { hasExpectedFileSignature } from '../../common/utils/file-signature';
import { removeUploadUrls } from '../../common/utils/upload-cleanup';
import { AuthService } from './auth.service';
import { RegisterDto } from './dto/register.dto';
import { SendOtpDto, VerifyOtpDto } from './dto/phone-otp.dto';
import { UpdateProfileDto } from './dto/update-profile.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { DeleteAccountDto } from './dto/delete-account.dto';
import { GoogleExchangeDto } from './dto/google-exchange.dto';
import { AdminLoginDto } from './dto/admin-login.dto';
import { GoogleAuthGuard, JwtAuthGuard } from './guards/auth.guards';
import type { AuthenticatedRequest } from './interfaces/auth.interface';

const PROFILE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register/send-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send registration OTP to a mobile number' })
  sendRegisterOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendRegisterOtp(dto.phoneNumber);
  }

  @Post('register/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Verify registration OTP and receive a registration token',
  })
  verifyRegisterOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyRegisterOtp(dto.phoneNumber, dto.code);
  }

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary:
      'Complete registration (registration token + profile + password)',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'phoneNumber',
        'registrationToken',
        'fullName',
        'email',
        'dateOfBirth',
        'password',
      ],
      properties: {
        phoneNumber: { type: 'string', example: '09123456789' },
        registrationToken: {
          type: 'string',
          example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        },
        fullName: { type: 'string', example: 'علی محمدی' },
        email: { type: 'string', example: 'ali@example.com' },
        dateOfBirth: { type: 'string', example: '1990-01-15' },
        password: { type: 'string', example: 'SecurePass1!' },
        profilePicture: { type: 'string', format: 'binary' },
      },
    },
  })
  @UseInterceptors(
    FileInterceptor('profilePicture', {
      storage: memoryStorage(),
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!PROFILE_MIME_EXTENSIONS[file.mimetype]) {
          cb(new BadRequestException('فقط فایل‌های تصویری مجاز هستند'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async register(
    @Body() dto: RegisterDto,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    let profilePictureUrl: string | undefined;

    if (file) {
      if (!hasExpectedFileSignature(file.buffer, file.mimetype)) {
        throw new BadRequestException('محتوای فایل تصویر معتبر نیست');
      }
      const filename = `${randomUUID()}${PROFILE_MIME_EXTENSIONS[file.mimetype]}`;
      const directory = join(process.cwd(), 'uploads', 'profile-pictures');
      await mkdir(directory, { recursive: true });
      await writeFile(join(directory, filename), file.buffer);
      profilePictureUrl = `/uploads/profile-pictures/${filename}`;
    }

    try {
      return await this.authService.register(dto, profilePictureUrl);
    } catch (error) {
      if (profilePictureUrl) {
        await removeUploadUrls([profilePictureUrl]);
      }
      throw error;
    }
  }

  @Post('login/send-otp')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Send login OTP to a registered mobile number' })
  sendLoginOtp(@Body() dto: SendOtpDto) {
    return this.authService.sendLoginOtp(dto.phoneNumber);
  }

  @Post('login/verify-otp')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({ summary: 'Verify login OTP and get an access token' })
  verifyLoginOtp(@Body() dto: VerifyOtpDto) {
    return this.authService.verifyLoginOtp(dto.phoneNumber, dto.code);
  }

  @Post('admin/login')
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiOperation({ summary: 'Admin login with username and password' })
  adminLogin(@Body() dto: AdminLoginDto) {
    return this.authService.adminLogin(dto);
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth login' })
  googleAuth() {
    // Redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({
    summary: 'Google OAuth callback',
    description:
      'Creates a one-time exchange code, then redirects to FRONTEND_REDIRECT_URL with code (or error).',
  })
  async googleAuthCallback(
    @Req() req: { user: Parameters<AuthService['handleGoogleLogin']>[0] },
    @Res() res: Response,
  ) {
    try {
      const { exchangeCode } = await this.authService.handleGoogleLogin(
        req.user,
      );
      return res.redirect(
        this.authService.buildFrontendRedirectUrl({ code: exchangeCode }),
      );
    } catch (error) {
      const message =
        error instanceof HttpException
          ? error.message
          : 'ورود با گوگل ناموفق بود';
      return res.redirect(
        this.authService.buildFrontendRedirectUrl({ error: message }),
      );
    }
  }

  @Post('google/exchange')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Exchange a one-time Google callback code for an access token',
  })
  exchangeGoogleCode(@Body() dto: GoogleExchangeDto) {
    return this.authService.exchangeGoogleCode(dto.code);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @Patch('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Update the current user profile (partial)',
    description: 'Send any subset of fullName, email, dateOfBirth.',
  })
  updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() dto: UpdateProfileDto,
  ) {
    return this.authService.updateProfile(req.user.sub, dto);
  }

  @Patch('me/password')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Change the current user password' })
  changePassword(
    @Req() req: AuthenticatedRequest,
    @Body() dto: ChangePasswordDto,
  ) {
    return this.authService.changePassword(req.user.sub, dto);
  }

  @Post('me/delete/send-otp')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Send OTP to confirm account deletion (Iranian mobile accounts)',
  })
  sendDeleteAccountOtp(@Req() req: AuthenticatedRequest) {
    return this.authService.sendDeleteAccountOtp(req.user.sub);
  }

  @Delete('me')
  @UseGuards(JwtAuthGuard)
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @ApiBearerAuth('JWT')
  @ApiOperation({
    summary: 'Delete (soft-delete) the current account',
    description:
      'Requires currentPassword or delete OTP when a password is set. Google-only accounts require a fresh googleExchangeCode (or delete OTP if a real mobile is linked).',
  })
  deleteAccount(
    @Req() req: AuthenticatedRequest,
    @Body() dto: DeleteAccountDto,
  ) {
    return this.authService.deleteAccount(req.user.sub, dto);
  }
}
