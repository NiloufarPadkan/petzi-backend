import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddTicketAttachmentsAndSubscriptionCancel1787860000000 implements MigrationInterface {
  name = 'AddTicketAttachmentsAndSubscriptionCancel1787860000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "attachments" jsonb NOT NULL DEFAULT '[]'`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP WITH TIME ZONE`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "cancelReason" text`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "cancelReason"`,
    );
    await queryRunner.query(
      `ALTER TABLE "subscriptions" DROP COLUMN "cancelledAt"`,
    );
    await queryRunner.query(
      `ALTER TABLE "support_tickets" DROP COLUMN "attachments"`,
    );
  }
}
