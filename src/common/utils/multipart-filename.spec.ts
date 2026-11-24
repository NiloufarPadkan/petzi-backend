import { decodeMultipartFilename } from './multipart-filename';

describe('decodeMultipartFilename', () => {
  it('keeps already-correct Persian names', () => {
    expect(decodeMultipartFilename('آزمایش خون.pdf')).toBe('آزمایش خون.pdf');
  });

  it('recovers Persian mojibake from Latin-1 misread UTF-8', () => {
    const utf8 = 'پت.pdf';
    const mojibake = Buffer.from(utf8, 'utf8').toString('latin1');
    expect(mojibake).not.toBe(utf8);
    expect(decodeMultipartFilename(mojibake)).toBe(utf8);
  });

  it('leaves plain ASCII alone', () => {
    expect(decodeMultipartFilename('report.pdf')).toBe('report.pdf');
  });
});
