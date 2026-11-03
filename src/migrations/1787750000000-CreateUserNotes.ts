import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateUserNotes1787750000000 implements MigrationInterface {
  name = 'CreateUserNotes1787750000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `CREATE TABLE "user_notes" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "userId" uuid NOT NULL,
        "authorId" uuid,
        "content" text NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_user_notes_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_user_notes_userId_createdAt" ON "user_notes" ("userId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notes" ADD CONSTRAINT "FK_user_notes_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notes" ADD CONSTRAINT "FK_user_notes_authorId" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `INSERT INTO "user_notes" ("userId", "content")
       SELECT "id", "adminNotes" FROM "users"
       WHERE "adminNotes" IS NOT NULL AND btrim("adminNotes") <> ''`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "adminNotes"`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" ADD "adminNotes" text`);
    await queryRunner.query(
      `UPDATE "users" SET "adminNotes" = n."content"
       FROM (
         SELECT DISTINCT ON ("userId") "userId", "content"
         FROM "user_notes"
         ORDER BY "userId", "createdAt" DESC
       ) n
       WHERE n."userId" = "users"."id"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notes" DROP CONSTRAINT "FK_user_notes_authorId"`,
    );
    await queryRunner.query(
      `ALTER TABLE "user_notes" DROP CONSTRAINT "FK_user_notes_userId"`,
    );
    await queryRunner.query(
      `DROP INDEX "public"."IDX_user_notes_userId_createdAt"`,
    );
    await queryRunner.query(`DROP TABLE "user_notes"`);
  }
}
