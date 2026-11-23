import { buildProviderShareUrl } from './provider-share-url';

describe('buildProviderShareUrl', () => {
  it('builds the vet link on the frontend route', () => {
    expect(
      buildProviderShareUrl('vet', 'v1', { publicSiteUrl: 'https://petzi.ir' }),
    ).toBe('https://petzi.ir/services/vet/v1');
  });

  it('builds the clinic link on the frontend route', () => {
    expect(
      buildProviderShareUrl('clinic', 'c1', {
        publicSiteUrl: 'https://petzi.ir',
      }),
    ).toBe('https://petzi.ir/services/clinic/c1');
  });

  it('ignores trailing slashes on the base', () => {
    expect(
      buildProviderShareUrl('vet', 'v1', {
        publicSiteUrl: 'https://petzi.ir///',
      }),
    ).toBe('https://petzi.ir/services/vet/v1');
  });

  describe('fallback', () => {
    it('uses the origin of the frontend redirect URL when site URL is unset', () => {
      expect(
        buildProviderShareUrl('vet', 'v1', {
          publicSiteUrl: '',
          frontendRedirectUrl: 'http://localhost:5173/auth/callback',
          corsOrigins: ['http://localhost:3000'],
        }),
      ).toBe('http://localhost:5173/services/vet/v1');
    });

    it('uses the first CORS origin when no frontend URL is usable', () => {
      expect(
        buildProviderShareUrl('clinic', 'c1', {
          publicSiteUrl: undefined,
          frontendRedirectUrl: 'not a url',
          corsOrigins: ['http://localhost:5173/', 'http://other'],
        }),
      ).toBe('http://localhost:5173/services/clinic/c1');
    });

    it('returns a relative path rather than null when nothing is configured', () => {
      expect(buildProviderShareUrl('vet', 'v1', {})).toBe('/services/vet/v1');
    });
  });
});
