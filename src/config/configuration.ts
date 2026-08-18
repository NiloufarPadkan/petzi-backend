const nodeEnv = process.env.NODE_ENV ?? 'development';

export default () => ({
  port: parseInt(process.env.PORT ?? '3000', 10),
  nodeEnv,
  database: {
    host: process.env.DB_HOST ?? 'localhost',
    port: parseInt(process.env.DB_PORT ?? '5432', 10),
    username: process.env.DB_USERNAME ?? 'postgres',
    password: process.env.DB_PASSWORD ?? 'postgres',
    database: process.env.DB_DATABASE ?? 'petzi',
    synchronize:
      process.env.DB_SYNCHRONIZE === 'true' ||
      (process.env.DB_SYNCHRONIZE !== 'false' && nodeEnv === 'development'),
  },
  jwt: {
    secret: process.env.JWT_SECRET ?? 'dev-secret-change-me',
    expiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
  },
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID ?? '',
    clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? '',
    callbackUrl:
      process.env.GOOGLE_CALLBACK_URL ??
      'http://localhost:3000/api/v1/auth/google/callback',
  },
  otp: {
    expiresInSeconds: parseInt(process.env.OTP_EXPIRES_IN_SECONDS ?? '120', 10),
    resendCooldownSeconds: parseInt(
      process.env.OTP_RESEND_COOLDOWN_SECONDS ?? '60',
      10,
    ),
  },
  sms: {
    provider: process.env.SMS_PROVIDER ?? 'mock',
  },
  appUrl: process.env.APP_URL ?? 'http://localhost:3000',
  cors: {
    origins: (process.env.CORS_ORIGINS ?? 'http://localhost:3000')
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
  },
  swagger: {
    enabled:
      process.env.SWAGGER_ENABLED === 'true' ||
      (process.env.SWAGGER_ENABLED !== 'false' && nodeEnv !== 'production'),
  },
});
