import { open } from 'node:fs/promises';

const SIGNATURE_LENGTH = 12;

function detectMimeType(buffer: Buffer): string | null {
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x89 &&
    buffer.subarray(1, 4).toString('ascii') === 'PNG'
  ) {
    return 'image/png';
  }
  if (
    buffer.length >= 3 &&
    buffer[0] === 0xff &&
    buffer[1] === 0xd8 &&
    buffer[2] === 0xff
  ) {
    return 'image/jpeg';
  }
  if (
    buffer.length >= 6 &&
    ['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii'))
  ) {
    return 'image/gif';
  }
  if (
    buffer.length >= 12 &&
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  ) {
    return 'image/webp';
  }
  if (
    buffer.length >= 5 &&
    buffer.subarray(0, 5).toString('ascii') === '%PDF-'
  ) {
    return 'application/pdf';
  }
  return null;
}

export function hasExpectedFileSignature(
  buffer: Buffer,
  expectedMimeType: string,
): boolean {
  return detectMimeType(buffer) === expectedMimeType;
}

export async function fileHasExpectedSignature(
  path: string,
  expectedMimeType: string,
): Promise<boolean> {
  const handle = await open(path, 'r');
  try {
    const buffer = Buffer.alloc(SIGNATURE_LENGTH);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    return hasExpectedFileSignature(
      buffer.subarray(0, bytesRead),
      expectedMimeType,
    );
  } finally {
    await handle.close();
  }
}
