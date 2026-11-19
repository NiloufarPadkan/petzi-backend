import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  Put,
  Req,
  ServiceUnavailableException,
} from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { AdminOnly } from '../../common/decorators/admin-only.decorator';
import { SettingsGroup } from '../../common/enums/admin-panel.enums';
import { IsIranianPhone } from '../../common/validators/is-iranian-phone.validator';
import type { AuthenticatedRequest } from '../auth/interfaces/auth.interface';
import { SettingsService } from './settings.service';

class TestSmsDto {
  @IsIranianPhone()
  phoneNumber: string;

  @IsOptional()
  @IsString()
  @MaxLength(300)
  message?: string;
}

@ApiTags('Admin Settings')
@AdminOnly()
@Controller('admin/settings')
export class AdminSettingsController {
  constructor(private readonly settingsService: SettingsService) {}

  @Get()
  @ApiOperation({ summary: 'All settings groups (secrets masked)' })
  @ApiOkResponse()
  getAll() {
    return this.settingsService.getAll();
  }

  @Post('email-sms/test-sms')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a test SMS through the configured provider' })
  async testSms(@Body() dto: TestSmsDto) {
    await this.settingsService.sendTestSms(dto.phoneNumber, dto.message);
  }

  @Post('email-sms/test-email')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Send a test email (no mail transport yet)' })
  testEmail() {
    throw new ServiceUnavailableException(
      'سرویس ایمیل هنوز پیاده‌سازی نشده است',
    );
  }

  @Get(':group')
  @ApiParam({ name: 'group', enum: SettingsGroup })
  @ApiOkResponse()
  getGroup(
    @Param('group', new ParseEnumPipe(SettingsGroup)) group: SettingsGroup,
  ) {
    return this.settingsService.getGroup(group);
  }

  @Put(':group')
  @ApiOperation({
    summary: 'Update some keys of a group; unknown keys are rejected',
  })
  @ApiParam({ name: 'group', enum: SettingsGroup })
  @ApiOkResponse()
  update(
    @Param('group', new ParseEnumPipe(SettingsGroup)) group: SettingsGroup,
    @Body() body: Record<string, unknown>,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.settingsService.updateGroup(group, body, req.user.sub);
  }
}
