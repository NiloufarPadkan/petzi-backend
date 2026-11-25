/**
 * Multer/busboy often exposes multipart filenames as a Latin-1 reading of the
 * UTF-8 bytes. Persian (and other non-Latin) names then look like mojibake
 * (e.g. "Ù¾Øª" instead of "پت"). Re-decode when the stored string has no
 * Arabic script but the Latin-1→UTF-8 round-trip does.
 */
export function decodeMultipartFilename(name: string): string {
  if (!name) return name;
  if (/[\u0600-\u06FF]/.test(name)) return name;

  try {
    const decoded = Buffer.from(name, 'latin1').toString('utf8');
    if (decoded.includes('\uFFFD')) return name;
    if (/[\u0600-\u06FF]/.test(decoded)) return decoded;
    return name;
  } catch {
    return name;
  }
}
