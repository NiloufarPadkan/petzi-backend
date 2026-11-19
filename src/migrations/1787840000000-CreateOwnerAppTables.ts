import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Pet-owner app: favorites, pet health data (weights, events, medications,
 * surgeries), notifications, plus columns on vaccines, reviews and payments.
 */
export class CreateOwnerAppTables1787840000000 implements MigrationInterface {
  name = 'CreateOwnerAppTables1787840000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    // ---- columns on existing tables ----
    await q(
      `ALTER TABLE "pet_vaccines" ADD COLUMN IF NOT EXISTS "nextDueDate" date`,
    );
    await q(`ALTER TABLE "pet_vaccines" ADD COLUMN IF NOT EXISTS "notes" text`);
    await q(
      `ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "planMonths" integer`,
    );
    for (const table of ['vet_reviews', 'clinic_reviews']) {
      await q(
        `ALTER TABLE "${table}" ADD COLUMN IF NOT EXISTS "reservationId" uuid`,
      );
      await q(
        `ALTER TABLE "${table}" ADD CONSTRAINT "UQ_${table}_reservationId" UNIQUE ("reservationId")`,
      );
      await q(
        `ALTER TABLE "${table}" ADD CONSTRAINT "FK_${table}_reservationId" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
      );
    }
    await q(
      `CREATE INDEX IF NOT EXISTS "IDX_pet_vaccines_nextDueDate" ON "pet_vaccines" ("nextDueDate") WHERE "nextDueDate" IS NOT NULL`,
    );

    // ---- favorites ----
    await q(
      `CREATE TYPE "public"."favorite_providers_providertype_enum" AS ENUM('vet', 'clinic')`,
    );
    await q(`CREATE TABLE "favorite_providers" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" uuid NOT NULL,
      "providerType" "public"."favorite_providers_providertype_enum" NOT NULL,
      "providerId" uuid NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_favorite_providers_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE UNIQUE INDEX "IDX_favorite_providers_unique" ON "favorite_providers" ("userId", "providerType", "providerId")`,
    );
    await q(
      `ALTER TABLE "favorite_providers" ADD CONSTRAINT "FK_favorite_providers_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ---- pet health ----
    await q(`CREATE TABLE "pet_weights" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "petId" uuid NOT NULL,
      "weightKg" double precision NOT NULL,
      "measuredAt" date NOT NULL,
      "note" text,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_pet_weights_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_pet_weights_pet_date" ON "pet_weights" ("petId", "measuredAt")`,
    );
    await q(
      `ALTER TABLE "pet_weights" ADD CONSTRAINT "FK_pet_weights_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await q(
      `CREATE TYPE "public"."pet_events_type_enum" AS ENUM('vaccination', 'deworming', 'grooming', 'vet_visit', 'illness', 'injury', 'medication', 'training', 'birthday', 'other')`,
    );
    await q(`CREATE TABLE "pet_events" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "petId" uuid NOT NULL,
      "type" "public"."pet_events_type_enum" NOT NULL,
      "title" character varying(150) NOT NULL,
      "note" text,
      "eventAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_pet_events_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_pet_events_pet_time" ON "pet_events" ("petId", "eventAt")`,
    );
    await q(
      `ALTER TABLE "pet_events" ADD CONSTRAINT "FK_pet_events_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await q(`CREATE TABLE "pet_medications" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "petId" uuid NOT NULL,
      "name" character varying(150) NOT NULL,
      "dosage" character varying(100),
      "frequency" character varying(100),
      "startDate" date NOT NULL,
      "endDate" date,
      "notes" text,
      "isActive" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_pet_medications_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_pet_medications_pet_active" ON "pet_medications" ("petId", "isActive")`,
    );
    await q(
      `ALTER TABLE "pet_medications" ADD CONSTRAINT "FK_pet_medications_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await q(
      `CREATE TYPE "public"."pet_surgeries_status_enum" AS ENUM('scheduled', 'done', 'cancelled')`,
    );
    await q(`CREATE TABLE "pet_surgeries" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "petId" uuid NOT NULL,
      "name" character varying(150) NOT NULL,
      "surgeryDate" date NOT NULL,
      "vetName" character varying(150),
      "clinicName" character varying(150),
      "notes" text,
      "status" "public"."pet_surgeries_status_enum" NOT NULL DEFAULT 'done',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_pet_surgeries_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_pet_surgeries_pet_date" ON "pet_surgeries" ("petId", "surgeryDate")`,
    );
    await q(
      `ALTER TABLE "pet_surgeries" ADD CONSTRAINT "FK_pet_surgeries_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ---- notifications ----
    await q(
      `CREATE TYPE "public"."notifications_type_enum" AS ENUM('reservation', 'vaccine_reminder', 'medication_reminder', 'checkup_reminder', 'payment', 'discount', 'system', 'general')`,
    );
    await q(`CREATE TABLE "notifications" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" uuid NOT NULL,
      "type" "public"."notifications_type_enum" NOT NULL,
      "title" character varying(200) NOT NULL,
      "body" text NOT NULL,
      "data" jsonb NOT NULL DEFAULT '{}',
      "dedupeKey" character varying(200),
      "readAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_notifications_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_notifications_user_created" ON "notifications" ("userId", "createdAt")`,
    );
    await q(
      `CREATE UNIQUE INDEX "IDX_notifications_user_dedupe" ON "notifications" ("userId", "dedupeKey")`,
    );
    await q(
      `ALTER TABLE "notifications" ADD CONSTRAINT "FK_notifications_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await q(
      `CREATE TYPE "public"."device_tokens_platform_enum" AS ENUM('android', 'ios', 'web')`,
    );
    await q(`CREATE TABLE "device_tokens" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" uuid NOT NULL,
      "token" character varying NOT NULL,
      "platform" "public"."device_tokens_platform_enum" NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_device_tokens_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_device_tokens_token" UNIQUE ("token")
    )`);
    await q(
      `CREATE INDEX "IDX_device_tokens_userId" ON "device_tokens" ("userId")`,
    );
    await q(
      `ALTER TABLE "device_tokens" ADD CONSTRAINT "FK_device_tokens_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TABLE "device_tokens"`);
    await q(`DROP TYPE "public"."device_tokens_platform_enum"`);
    await q(`DROP TABLE "notifications"`);
    await q(`DROP TYPE "public"."notifications_type_enum"`);
    await q(`DROP TABLE "pet_surgeries"`);
    await q(`DROP TYPE "public"."pet_surgeries_status_enum"`);
    await q(`DROP TABLE "pet_medications"`);
    await q(`DROP TABLE "pet_events"`);
    await q(`DROP TYPE "public"."pet_events_type_enum"`);
    await q(`DROP TABLE "pet_weights"`);
    await q(`DROP TABLE "favorite_providers"`);
    await q(`DROP TYPE "public"."favorite_providers_providertype_enum"`);
    await q(`DROP INDEX IF EXISTS "public"."IDX_pet_vaccines_nextDueDate"`);
    for (const table of ['clinic_reviews', 'vet_reviews']) {
      await q(
        `ALTER TABLE "${table}" DROP CONSTRAINT "FK_${table}_reservationId"`,
      );
      await q(
        `ALTER TABLE "${table}" DROP CONSTRAINT "UQ_${table}_reservationId"`,
      );
      await q(`ALTER TABLE "${table}" DROP COLUMN "reservationId"`);
    }
    await q(`ALTER TABLE "payments" DROP COLUMN "planMonths"`);
    await q(`ALTER TABLE "pet_vaccines" DROP COLUMN "notes"`);
    await q(`ALTER TABLE "pet_vaccines" DROP COLUMN "nextDueDate"`);
  }
}
