import { BadRequestException } from '@nestjs/common';
import type { MulterOptions } from '@nestjs/platform-express/multer/interfaces/multer-options.interface';
import { memoryStorage } from 'multer';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { hasExpectedFileSignature } from './file-signature';

const IMAGE_MIME_EXTENSIONS: Record<string, string> = {
  'image/jpeg': '.jpg',
  'image/png': '.png',
  'image/webp': '.webp',
};

/** Multer options for one image kept in memory until it is verified. */
export function imageUploadOptions(maxBytes: number): MulterOptions {
  return {
    storage: memoryStorage(),
    limits: { fileSize: maxBytes },
    fileFilter: (_req, file, cb) => {
      if (!IMAGE_MIME_EXTENSIONS[file.mimetype]) {
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

/**
 * Verifies the file really is an image, stores it under `uploads/<directory>`
 * and returns its public URL.
 */
export async function saveImage(
  file: Express.Multer.File | undefined,
  directory: string,
): Promise<string> {
  if (!file) {
    throw new BadRequestException('فایل تصویر ارسال نشد');
  }
  if (!hasExpectedFileSignature(file.buffer, file.mimetype)) {
    throw new BadRequestException('محتوای فایل تصویر معتبر نیست');
  }

  const filename = `${randomUUID()}${IMAGE_MIME_EXTENSIONS[file.mimetype]}`;
  const target = join(process.cwd(), 'uploads', directory);
  await mkdir(target, { recursive: true });
  await writeFile(join(target, filename), file.buffer);
  return `/uploads/${directory}/${filename}`;
}
