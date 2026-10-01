import { MigrationInterface, QueryRunner } from 'typeorm';

export class AuthOneTimeTokensAndDeleteOtp1787800000000
  implements MigrationInterface
{
  name = 'AuthOneTimeTokensAndDeleteOtp1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."otps_purpose_enum" ADD VALUE IF NOT EXISTS 'delete_account'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."one_time_tokens_purpose_enum" AS ENUM('register', 'google_exchange')`,
    );
    await queryRunner.query(`
      CREATE TABLE "one_time_tokens" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "jti" character varying(64) NOT NULL,
        "purpose" "public"."one_time_tokens_purpose_enum" NOT NULL,
        "phoneNumber" character varying,
        "userId" uuid,
        "expiresAt" TIMESTAMP NOT NULL,
        "isUsed" boolean NOT NULL DEFAULT false,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_one_time_tokens" PRIMARY KEY ("id")
      )
    `);
    await queryRunner.query(
      `CREATE UNIQUE INDEX "IDX_one_time_tokens_jti" ON "one_time_tokens" ("jti")`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP INDEX "public"."IDX_one_time_tokens_jti"`);
    await queryRunner.query(`DROP TABLE "one_time_tokens"`);
    await queryRunner.query(
      `DROP TYPE "public"."one_time_tokens_purpose_enum"`,
    );
    // Postgres cannot easily remove enum values; leave otps_purpose_enum as-is.
  }
}
