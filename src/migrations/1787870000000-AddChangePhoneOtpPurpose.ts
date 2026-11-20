import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddChangePhoneOtpPurpose1787870000000 implements MigrationInterface {
  name = 'AddChangePhoneOtpPurpose1787870000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."otps_purpose_enum" ADD VALUE IF NOT EXISTS 'change_phone'`,
    );
  }

  public down(): Promise<void> {
    // Postgres cannot drop an enum value; leave otps_purpose_enum as-is.
    return Promise.resolve();
  }
}
