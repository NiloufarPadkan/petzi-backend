import { imageUploadOptions, saveImage } from '../../common/utils/image-upload';

export const CLINIC_MEDIA_DIRECTORY = 'clinic-media';
export const LOGO_MAX_BYTES = 2 * 1024 * 1024;
export const IMAGE_MAX_BYTES = 5 * 1024 * 1024;

export const clinicImageUploadOptions = imageUploadOptions;

/** Verifies the file really is an image, stores it, and returns its URL. */
export function saveClinicImage(
  file: Express.Multer.File | undefined,
): Promise<string> {
  return saveImage(file, CLINIC_MEDIA_DIRECTORY);
}
