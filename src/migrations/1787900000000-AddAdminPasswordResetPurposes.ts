import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddAdminPasswordResetPurposes1787900000000
  implements MigrationInterface
{
  name = 'AddAdminPasswordResetPurposes1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."otps_purpose_enum" ADD VALUE IF NOT EXISTS 'admin_password_reset'`,
    );
    await queryRunner.query(
      `ALTER TYPE "public"."one_time_tokens_purpose_enum" ADD VALUE IF NOT EXISTS 'admin_password_reset'`,
    );
  }

  public down(): Promise<void> {
    // Postgres cannot drop enum values; leave both enums as-is.
    return Promise.resolve();
  }
}
