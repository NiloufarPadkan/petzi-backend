const INSECURE_JWT_SECRETS = new Set([
  '',
  'dev-secret-change-me',
  'your-super-secret-jwt-key-change-in-production',
]);

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

export function validateEnvironment(
  environment: Record<string, unknown>,
): Record<string, unknown> {
  const nodeEnv = readString(environment.NODE_ENV, 'development');
  const jwtSecret = readString(environment.JWT_SECRET, '');

  if (nodeEnv === 'production' && INSECURE_JWT_SECRETS.has(jwtSecret)) {
    throw new Error('JWT_SECRET must be set to a secure value in production');
  }

  if (
    nodeEnv === 'production' &&
    readString(environment.DB_SYNCHRONIZE, 'false') === 'true'
  ) {
    throw new Error(
      'DB_SYNCHRONIZE must be false in production; use migrations',
    );
  }

  return environment;
}
