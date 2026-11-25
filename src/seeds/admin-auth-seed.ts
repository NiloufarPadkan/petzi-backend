/**
 * Extra admin account for the admin forgot-password e2e (so resetting its
 * password never invalidates the shared `e2eadmin` session other specs use).
 * Idempotent; dev only.
 *
 *   docker exec petzi-backend-api-1 npx ts-node -r tsconfig-paths/register src/seeds/admin-auth-seed.ts
 *
 * Login: username `e2eresetadmin`, mobile 09129999998, password `E2eAdmin!2026`.
 */
import * as bcrypt from 'bcrypt';
import { AppDataSource } from '../config/data-source';

if (process.env.NODE_ENV === 'production') {
  console.error('admin-auth-seed: refusing to run with NODE_ENV=production');
  process.exit(1);
}

async function main() {
  await AppDataSource.initialize();
  try {
    await AppDataSource.query(
      `INSERT INTO "users" ("id","username","phoneNumber","fullName","role","isPhoneVerified","isEmailVerified","notificationPreferences","twoFactorEnabled","password")
       VALUES ($1,$2,$3,$4,'admin',true,false,'{}',false,$5)
       ON CONFLICT DO NOTHING`,
      [
        '5eed0000-0000-4000-8001-000000000098',
        'e2eresetadmin',
        '09129999998',
        'ادمین بازیابی',
        await bcrypt.hash('E2eAdmin!2026', 10),
      ],
    );
    console.log('admin-auth-seed: done');
  } finally {
    await AppDataSource.destroy();
  }
}

void main();
