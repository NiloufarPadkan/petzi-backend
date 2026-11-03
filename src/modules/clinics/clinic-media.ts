import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hasExpectedFileSignature } from '../../common/utils/file-signature';

const MEDIA_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

export const CLINIC_MEDIA_DIRECTORY = 'clinic-media';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export function clinicImageUploadOptions(maxBytes: number): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!MEDIA_MIME_EXTENSIONS[file.mimetype]) {
        cb(
          new BadRequestException('فقط تصاویر JPG، PNG و WEBP مجاز هستند'),
          false,
        );
        return;
      }
      cb(null, true);
    },
  };
}

/** Verifies the file really is an image, stores it, and returns its URL. */
export async function saveClinicImage(
  file: Express.Multer.File | undefined,
): Promise<string> {
  if (!file) {
    throw new BadRequestException('فایل تصویر ارسال نشد');
  }
  if (!hasExpectedFileSignature(file.buffer, file.mimetype)) {
    throw new BadRequestException('محتوای فایل تصویر معتبر نیست');
  }

  const filename = `${randomUUID()}${MEDIA_MIME_EXTENSIONS[file.mimetype]}`;
  const directory = join(process.cwd(), 'uploads', CLINIC_MEDIA_DIRECTORY);
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, filename), file.buffer);
  return `/uploads/${CLINIC_MEDIA_DIRECTORY}/${filename}`;
}
