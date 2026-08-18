import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Post,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
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

  @Post('register')
  @Throttle({ default: { limit: 10, ttl: 60_000 } })
  @ApiOperation({
    summary: 'Complete registration in one request (OTP + profile + password)',
  })
  @ApiConsumes('multipart/form-data', 'application/json')
  @ApiBody({
    schema: {
      type: 'object',
      required: [
        'phoneNumber',
        'code',
        'fullName',
        'email',
        'dateOfBirth',
        'password',
      ],
      properties: {
        phoneNumber: { type: 'string', example: '09123456789' },
        code: { type: 'string', example: '123456' },
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

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Redirect to Google OAuth login' })
  googleAuth() {
    // Redirects to Google
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  @ApiOperation({ summary: 'Google OAuth callback' })
  async googleAuthCallback(
    @Req() req: { user: Parameters<AuthService['handleGoogleLogin']>[0] },
  ) {
    return this.authService.handleGoogleLogin(req.user);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth('JWT')
  @ApiOperation({ summary: 'Get the current authenticated user' })
  getProfile(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }
}
