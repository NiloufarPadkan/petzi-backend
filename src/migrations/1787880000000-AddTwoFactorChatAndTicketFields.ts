import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Two-step login (users + one-time tokens), unread tracking for the user's
 * side of support chat, and the report-a-problem section/time fields.
 */
export class AddTwoFactorChatAndTicketFields1787880000000 implements MigrationInterface {
  name = 'AddTwoFactorChatAndTicketFields1787880000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    await q(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorEnabled" boolean NOT NULL DEFAULT false`,
    );
    await q(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "twoFactorRecoveryCodes" jsonb`,
    );
    await q(
      `ALTER TYPE "public"."one_time_tokens_purpose_enum" ADD VALUE IF NOT EXISTS 'two_factor'`,
    );
    await q(
      `ALTER TABLE "one_time_tokens" ADD COLUMN IF NOT EXISTS "failedAttempts" smallint NOT NULL DEFAULT 0`,
    );

    await q(
      `ALTER TABLE "conversations" ADD COLUMN IF NOT EXISTS "unreadByUser" integer NOT NULL DEFAULT 0`,
    );

    await q(
      `ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "relatedSection" character varying(100)`,
    );
    await q(
      `ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "occurredAt" TIMESTAMP WITH TIME ZONE`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`ALTER TABLE "support_tickets" DROP COLUMN "occurredAt"`);
    await q(`ALTER TABLE "support_tickets" DROP COLUMN "relatedSection"`);
    await q(`ALTER TABLE "conversations" DROP COLUMN "unreadByUser"`);
    await q(`ALTER TABLE "one_time_tokens" DROP COLUMN "failedAttempts"`);
    await q(`ALTER TABLE "users" DROP COLUMN "twoFactorRecoveryCodes"`);
    await q(`ALTER TABLE "users" DROP COLUMN "twoFactorEnabled"`);
    // Postgres cannot drop the 'two_factor' enum value; it is left in place.
  }
}
