import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddPetPhoto1787850000000 implements MigrationInterface {
  name = 'AddPetPhoto1787850000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "photoUrl" character varying`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`ALTER TABLE "pets" DROP COLUMN "photoUrl"`);
  }
}
