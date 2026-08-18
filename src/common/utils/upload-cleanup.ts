import { unlink } from 'node:fs/promises';
import { join, normalize } from 'node:path';

async function removeFile(path: string): Promise<void> {
  try {
    await unlink(path);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error;
    }
  }
}

export async function removeUploadedFiles(
  files: Express.Multer.File[],
): Promise<void> {
  await Promise.all(files.map((file) => removeFile(file.path)));
}

export async function removeUploadUrls(urls: string[]): Promise<void> {
  const uploadRoot = normalize(join(process.cwd(), 'uploads'));

  await Promise.all(
    urls.map(async (url) => {
      const path = normalize(join(process.cwd(), url.replace(/^[/\\]+/, '')));
      if (
        !path.startsWith(`${uploadRoot}\\`) &&
        !path.startsWith(`${uploadRoot}/`)
      ) {
        return;
      }
      await removeFile(path);
    }),
  );
}
