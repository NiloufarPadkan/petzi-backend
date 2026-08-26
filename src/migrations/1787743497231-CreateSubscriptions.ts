import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateSubscriptions1787743497231 implements MigrationInterface {
  name = 'CreateSubscriptions1787743497231';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_plan_enum" AS ENUM('free', 'monthly', 'yearly')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."subscriptions_status_enum" AS ENUM('active', 'inactive', 'pending_approval')`,
    );
    await queryRunner.query(
      `CREATE TABLE "subscriptions" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "plan" "public"."subscriptions_plan_enum" NOT NULL DEFAULT 'free',
        "status" "public"."subscriptions_status_enum" NOT NULL DEFAULT 'active',
        "startedAt" TIMESTAMP WITH TIME ZONE,
        "expiresAt" TIMESTAMP WITH TIME ZONE,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_subscriptions_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_subscriptions_userId" ON "subscriptions" ("userId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_userId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_subscriptions_userId"`);
    await queryRunner.query(`DROP TABLE "subscriptions"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_status_enum"`);
    await queryRunner.query(`DROP TYPE "public"."subscriptions_plan_enum"`);
  }
}
