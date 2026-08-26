import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddUserAdminFields1787744223692 implements MigrationInterface {
  name = 'AddUserAdminFields1787744223692';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "users" ADD "notificationPreferences" jsonb NOT NULL DEFAULT '{"newsletter":false,"reservationAlerts":true,"messageAlerts":true}'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "statusChangeReason" text`,
    );
    await queryRunner.query(`ALTER TABLE "users" ADD "adminNotes" text`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "adminNotes"`);
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "statusChangeReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" DROP COLUMN "notificationPreferences"`,
    );
  }
}
