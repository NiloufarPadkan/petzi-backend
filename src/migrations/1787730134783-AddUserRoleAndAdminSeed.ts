import { MigrationInterface, QueryRunner } from 'typeorm';

const ADMIN_USERNAME = 'petziappadmin';
const ADMIN_PASSWORD_HASH =
  '$2b$12$e8lB5Q7KnYMva47udNgZT.A/ZJMNyYx2.pmiAioPa9bXlD8TR8h9m';
const ADMIN_PHONE_PLACEHOLDER = `admin_${ADMIN_USERNAME}`;

export class AddUserRoleAndAdminSeed1787730134783 implements MigrationInterface {
  name = 'AddUserRoleAndAdminSeed1787730134783';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "username" character varying`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD CONSTRAINT "UQ_users_username" UNIQUE ("username")`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."users_role_enum" AS ENUM('user', 'admin')`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "role" "public"."users_role_enum" NOT NULL DEFAULT 'user'`,
    );

    await queryRunner.query(
      `INSERT INTO "users" ("username", "phoneNumber", "password", "role", "isPhoneVerified", "isEmailVerified")
       VALUES ($1, $2, $3, 'admin', true, false)`,
      [ADMIN_USERNAME, ADMIN_PHONE_PLACEHOLDER, ADMIN_PASSWORD_HASH],
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DELETE FROM "users" WHERE "username" = $1`, [
      ADMIN_USERNAME,
    ]);

    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "role"`);
    await queryRunner.query(`DROP TYPE "public"."users_role_enum"`);

    await queryRunner.query(
      `ALTER TABLE "users" DROP CONSTRAINT "UQ_users_username"`,
    );
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "username"`);
  }
}
