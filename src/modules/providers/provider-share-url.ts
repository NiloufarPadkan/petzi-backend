/**
 * Single source of truth for provider share paths. Must mirror the frontend
 * routes (PETZI `src/app/router.tsx`): `/services/vet/:id`, `/services/clinic/:id`.
 */
export const PROVIDER_SHARE_PATHS = {
  vet: '/services/vet',
  clinic: '/services/clinic',
} as const;

export type ProviderShareKind = keyof typeof PROVIDER_SHARE_PATHS;

export interface ShareBaseSources {
  /** PUBLIC_SITE_URL */
  publicSiteUrl?: string | null;
  /** FRONTEND_REDIRECT_URL (full URL; only its origin is used) */
  frontendRedirectUrl?: string | null;
  /** CORS_ORIGINS (first entry is used) */
  corsOrigins?: string[] | null;
}

function originOf(url?: string | null): string | null {
  if (!url) return null;
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/**
 * Base resolution order: PUBLIC_SITE_URL, origin of FRONTEND_REDIRECT_URL,
 * first CORS origin, then '' (yields a relative path).
 */
export function resolveShareBase(sources: ShareBaseSources): string {
  const base =
    sources.publicSiteUrl?.trim() ||
    originOf(sources.frontendRedirectUrl) ||
    sources.corsOrigins?.find((origin) => origin.trim())?.trim() ||
    '';
  return base.replace(/\/+$/, '');
}

export function buildProviderShareUrl(
  kind: ProviderShareKind,
  id: string,
  sources: ShareBaseSources,
): string {
  return `${resolveShareBase(sources)}${PROVIDER_SHARE_PATHS[kind]}/${id}`;
}
