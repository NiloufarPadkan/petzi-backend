import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
  Res,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { join } from 'node:path';
import ExcelJS from 'exceljs';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
} from '@nestjs/swagger';
import { hasExpectedFileSignature } from '../../common/utils/file-signature';
import { UserRole } from '../../common/enums/user-role.enum';
import { Roles } from '../../common/decorators/roles.decorator';
import { RolesGuard } from '../../common/guards/roles.guard';
import { JwtAuthGuard } from '../auth/guards/auth.guards';
import { AdminUsersService } from './admin-users.service';
import { AdminUsersListResponseDto } from './dto/admin-user-response.dto';
import { QueryAdminUsersDto } from './dto/query-admin-users.dto';
import { UpdateAdminUserDto } from './dto/update-admin-user.dto';

const PROFILE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

const SUBSCRIPTION_PLAN_LABELS: Record<string, string> = {
  free: 'رایگان',
  monthly: 'یک ماهه',
  yearly: 'سالانه',
};

const SUBSCRIPTION_STATUS_LABELS: Record<string, string> = {
  active: 'فعال',
  inactive: 'غیرفعال',
  pending_approval: 'در انتظار تایید',
};

@ApiTags('Admin Users')
@ApiBearerAuth('JWT')
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles(UserRole.ADMIN)
@Controller('admin/users')
export class UsersController {
  constructor(private readonly adminUsersService: AdminUsersService) {}

  @Get()
  @ApiOperation({
    summary: 'List pet-owner users with search/filter/pagination',
  })
  @ApiOkResponse({ type: AdminUsersListResponseDto })
  findAll(@Query() query: QueryAdminUsersDto) {
    return this.adminUsersService.findAll(query);
  }

  @Get('export')
  @ApiOperation({ summary: 'Export the filtered user list as an Excel file' })
  async export(@Query() query: QueryAdminUsersDto, @Res() res: Response) {
    const items = await this.adminUsersService.findAllForExport(query);

    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet('Users');
    sheet.columns = [
      { header: 'نام', key: 'fullName', width: 25 },
      { header: 'ایمیل', key: 'email', width: 30 },
      { header: 'شماره موبایل', key: 'phoneNumber', width: 18 },
      { header: 'شهر', key: 'city', width: 15 },
      { header: 'تعداد پت‌ها', key: 'petsCount', width: 12 },
      { header: 'وضعیت اشتراک', key: 'subscriptionPlan', width: 15 },
      { header: 'وضعیت', key: 'subscriptionStatus', width: 15 },
    ];

    for (const item of items) {
      sheet.addRow({
        fullName: item.fullName ?? '',
        email: item.email ?? '',
        phoneNumber: item.phoneNumber,
        city: item.city ?? '',
        petsCount: item.petsCount,
        subscriptionPlan:
          SUBSCRIPTION_PLAN_LABELS[item.subscriptionPlan] ??
          item.subscriptionPlan,
        subscriptionStatus:
          SUBSCRIPTION_STATUS_LABELS[item.subscriptionStatus] ??
          item.subscriptionStatus,
      });
    }

    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="pet-owners.xlsx"',
    );

    await workbook.xlsx.write(res);
    res.end();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a single user by id' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a user (partial)' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminUserDto,
  ) {
    return this.adminUsersService.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete (soft-delete) a user' })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiNoContentResponse()
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.remove(id);
  }

  @Post(':id/profile-picture')
  @ApiOperation({ summary: "Upload a user's profile picture" })
  @ApiParam({ name: 'id', description: 'User UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { profilePicture: { type: 'string', format: 'binary' } },
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
  async uploadProfilePicture(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() file?: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('فایل تصویر ارسال نشد');
    }
    if (!hasExpectedFileSignature(file.buffer, file.mimetype)) {
      throw new BadRequestException('محتوای فایل تصویر معتبر نیست');
    }

    const filename = `${randomUUID()}${PROFILE_MIME_EXTENSIONS[file.mimetype]}`;
    const directory = join(process.cwd(), 'uploads', 'profile-pictures');
    await mkdir(directory, { recursive: true });
    await writeFile(join(directory, filename), file.buffer);

    return this.adminUsersService.updateProfilePicture(
      id,
      `/uploads/profile-pictures/${filename}`,
    );
  }

  @Delete(':id/profile-picture')
  @ApiOperation({ summary: "Remove a user's profile picture" })
  @ApiParam({ name: 'id', description: 'User UUID' })
  removeProfilePicture(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminUsersService.removeProfilePicture(id);
  }
}
