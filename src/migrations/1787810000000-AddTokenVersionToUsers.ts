import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTokenVersionToUsers1787810000000 implements MigrationInterface {
  name = 'AddTokenVersionToUsers1787810000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "tokenVersion" integer NOT NULL DEFAULT 0`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "tokenVersion"`,
    );
  }
}
