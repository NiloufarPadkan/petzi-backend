import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * The schema that existed before the first migration: users, otps, pets,
 * pet_vaccines, pet_documents and addresses.
 *
 * Earlier environments built these tables with `synchronize`, so no migration
 * ever created them and a fresh database could not be migrated. This runs
 * first on an empty database and does nothing on one that already has tables.
 */
const BASE_SCHEMA = [
  `CREATE TABLE "users" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phoneNumber" character varying NOT NULL, "fullName" character varying, "email" character varying, "dateOfBirth" date, "password" character varying, "profilePictureUrl" character varying, "googleId" character varying, "isPhoneVerified" boolean NOT NULL DEFAULT false, "isEmailVerified" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), "deletedAt" TIMESTAMP, CONSTRAINT "UQ_1e3d0240b49c40521aaeb953293" UNIQUE ("phoneNumber"), CONSTRAINT "UQ_97672ac88f789774dd47f7c8be3" UNIQUE ("email"), CONSTRAINT "UQ_f382af58ab36057334fb262efd5" UNIQUE ("googleId"), CONSTRAINT "PK_a3ffb1c0c8416b9fc6f907b7433" PRIMARY KEY ("id"))`,
  `CREATE TYPE "public"."otps_purpose_enum" AS ENUM('register', 'login')`,
  `CREATE TABLE "otps" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "phoneNumber" character varying NOT NULL, "codeHash" character varying(64) NOT NULL, "purpose" "public"."otps_purpose_enum" NOT NULL, "expiresAt" TIMESTAMP NOT NULL, "isUsed" boolean NOT NULL DEFAULT false, "failedAttempts" smallint NOT NULL DEFAULT '0', "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_91fef5ed60605b854a2115d2410" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_58625116ebfab4361d826462bf" ON "otps"  ("phoneNumber", "purpose", "isUsed")`,
  `CREATE TABLE "pet_vaccines" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "petId" uuid NOT NULL, "vaccineName" character varying NOT NULL, "vaccineDate" date NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_0b0c7bf68e97568e805e4540775" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_f112995db54b089f263c766df7" ON "pet_vaccines"  ("petId")`,
  `CREATE TABLE "pet_documents" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "petId" uuid NOT NULL, "originalName" character varying NOT NULL, "fileUrl" character varying NOT NULL, "mimeType" character varying NOT NULL, "sizeBytes" integer NOT NULL, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_88ef857c05603b65c9f3a555225" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_9bfd807a874e0b2362386a4469" ON "pet_documents"  ("petId")`,
  `CREATE TYPE "public"."pets_status_enum" AS ENUM('draft', 'active')`,
  `CREATE TYPE "public"."pets_type_enum" AS ENUM('cat', 'dog', 'rabbit', 'bird', 'hamster', 'snake', 'other')`,
  `CREATE TYPE "public"."pets_gender_enum" AS ENUM('male', 'female', 'unknown')`,
  `CREATE TYPE "public"."pets_approximateage_enum" AS ENUM('less_than_6_months', '6_months_to_1_year', '2_to_4_years', '4_to_6_years', 'above_7_years')`,
  `CREATE TYPE "public"."pets_healthstatus_enum" AS ENUM('excellent', 'good', 'average', 'needs_checkup')`,
  `CREATE TYPE "public"."pets_vaccinationstatus_enum" AS ENUM('none', 'in_progress', 'complete')`,
  `CREATE TYPE "public"."pets_foodtype_enum" AS ENUM('dry', 'wet', 'homemade', 'mixed')`,
  `CREATE TYPE "public"."pets_mealsperday_enum" AS ENUM('1', '2', '3', '4', 'more')`,
  `CREATE TABLE "pets" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "ownerId" uuid NOT NULL, "status" "public"."pets_status_enum" NOT NULL DEFAULT 'draft', "name" character varying, "type" "public"."pets_type_enum", "breed" character varying, "gender" "public"."pets_gender_enum", "birthDate" date, "approximateAge" "public"."pets_approximateage_enum", "color" character varying, "appearanceFeatures" text, "weight" double precision, "height" double precision, "healthStatus" "public"."pets_healthstatus_enum", "underlyingDiseases" text DEFAULT 'None', "allergies" text DEFAULT 'None', "medications" text DEFAULT 'None', "healthNotes" text, "vaccinationStatus" "public"."pets_vaccinationstatus_enum", "lastDewormingDate" date, "dewormingType" character varying, "foodType" "public"."pets_foodtype_enum", "foodBrand" character varying, "mealsPerDay" "public"."pets_mealsperday_enum", "foodSensitivities" text DEFAULT 'None', "surgeries" text DEFAULT 'None', "previousDiseases" text DEFAULT 'None', "hospitalizations" text DEFAULT 'None', "additionalNotes" text, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_d01e9e7b4ada753c826720bee8b" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_bc9d71203a3ff2ca18176857e7" ON "pets"  ("ownerId", "status")`,
  `CREATE TABLE "addresses" ("id" uuid NOT NULL DEFAULT uuid_generate_v4(), "userId" uuid NOT NULL, "title" character varying(100) NOT NULL, "city" character varying(100) NOT NULL, "full_address" character varying(500) NOT NULL, "latitude" numeric(10,7) NOT NULL, "longitude" numeric(10,7) NOT NULL, "isDefault" boolean NOT NULL DEFAULT false, "createdAt" TIMESTAMP NOT NULL DEFAULT now(), "updatedAt" TIMESTAMP NOT NULL DEFAULT now(), CONSTRAINT "PK_745d8f43d3af10ab8247465e450" PRIMARY KEY ("id"))`,
  `CREATE INDEX "IDX_52be2d5092d78524afe4efa164" ON "addresses"  ("userId", "isDefault")`,
  `CREATE INDEX "IDX_95c93a584de49f0b0e13f75363" ON "addresses"  ("userId")`,
  `ALTER TABLE "pet_vaccines" ADD CONSTRAINT "FK_f112995db54b089f263c766df70" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "pet_documents" ADD CONSTRAINT "FK_9bfd807a874e0b2362386a4469b" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "pets" ADD CONSTRAINT "FK_275e1bb3fdeea68f8356d8e1ebb" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
  `ALTER TABLE "addresses" ADD CONSTRAINT "FK_95c93a584de49f0b0e13f753630" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
];

export class CreateBaseSchema1787700000000 implements MigrationInterface {
  name = 'CreateBaseSchema1787700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    if (await queryRunner.hasTable('users')) return;

    await queryRunner.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`);
    for (const statement of BASE_SCHEMA) {
      await queryRunner.query(statement);
    }
  }

  public down(): Promise<void> {
    // Deliberately empty: on an existing database `up` created nothing, so
    // dropping these tables here would destroy data that was never ours.
    return Promise.resolve();
  }
}
