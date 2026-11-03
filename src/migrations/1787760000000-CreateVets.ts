import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateVets1787760000000 implements MigrationInterface {
  name = 'CreateVets1787760000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'vet'`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "isSuspended" boolean NOT NULL DEFAULT false`,
    );
    await queryRunner.query(
      `ALTER TABLE "users" ADD "lastLoginAt" TIMESTAMP WITH TIME ZONE`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."vet_profiles_gender_enum" AS ENUM('male', 'female')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vet_profiles_verificationstatus_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."vet_profiles_collaborationstatus_enum" AS ENUM('active', 'inactive', 'suspended')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vet_profiles" (
        "userId" uuid NOT NULL,
        "medicalCouncilNumber" character varying NOT NULL,
        "nationalCode" character varying(10),
        "gender" "public"."vet_profiles_gender_enum",
        "bio" text,
        "city" character varying(100) NOT NULL,
        "primarySpecialty" character varying(100) NOT NULL,
        "subSpecialties" text array NOT NULL DEFAULT '{}',
        "highestDegree" character varying(100),
        "university" character varying(150),
        "graduationYear" integer,
        "languages" text array NOT NULL DEFAULT '{}',
        "clinicName" character varying(150),
        "clinicPhone" character varying(20),
        "clinicAddress" text,
        "instagram" character varying(100),
        "telegram" character varying(100),
        "linkedin" character varying(200),
        "verificationStatus" "public"."vet_profiles_verificationstatus_enum" NOT NULL DEFAULT 'pending',
        "collaborationStatus" "public"."vet_profiles_collaborationstatus_enum" NOT NULL DEFAULT 'active',
        "adminNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_vet_profiles_medicalCouncilNumber" UNIQUE ("medicalCouncilNumber"),
        CONSTRAINT "PK_vet_profiles_userId" PRIMARY KEY ("userId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_profiles_verificationStatus" ON "vet_profiles" ("verificationStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_profiles_city" ON "vet_profiles" ("city")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_profiles" ADD CONSTRAINT "FK_vet_profiles_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."vet_documents_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vet_documents" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vetId" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "originalName" character varying NOT NULL,
        "fileUrl" character varying NOT NULL,
        "mimeType" character varying NOT NULL,
        "sizeBytes" integer NOT NULL,
        "status" "public"."vet_documents_status_enum" NOT NULL DEFAULT 'pending',
        "rejectionReason" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vet_documents_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_documents_vetId" ON "vet_documents" ("vetId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_documents" ADD CONSTRAINT "FK_vet_documents_vetId" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "vet_services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vetId" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "category" character varying(100) NOT NULL,
        "basePrice" integer NOT NULL,
        "durationMinutes" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vet_services_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_services_vetId" ON "vet_services" ("vetId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_services" ADD CONSTRAINT "FK_vet_services_vetId" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "vet_working_hours" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vetId" uuid NOT NULL,
        "dayOfWeek" smallint NOT NULL,
        "isActive" boolean NOT NULL DEFAULT false,
        "morningEnabled" boolean NOT NULL DEFAULT false,
        "morningStart" character varying(5),
        "morningEnd" character varying(5),
        "morningMaxAppointments" integer,
        "eveningEnabled" boolean NOT NULL DEFAULT false,
        "eveningStart" character varying(5),
        "eveningEnd" character varying(5),
        "eveningMaxAppointments" integer,
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "UQ_vet_working_hours_vetId_dayOfWeek" UNIQUE ("vetId", "dayOfWeek"),
        CONSTRAINT "PK_vet_working_hours_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_working_hours" ADD CONSTRAINT "FK_vet_working_hours_vetId" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."vet_reviews_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vet_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vetId" uuid NOT NULL,
        "authorId" uuid,
        "rating" smallint NOT NULL,
        "comment" text NOT NULL,
        "reply" text,
        "repliedAt" TIMESTAMP WITH TIME ZONE,
        "status" "public"."vet_reviews_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vet_reviews_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_reviews_vetId_status" ON "vet_reviews" ("vetId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_reviews" ADD CONSTRAINT "FK_vet_reviews_vetId" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_reviews" ADD CONSTRAINT "FK_vet_reviews_authorId" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."vet_status_logs_type_enum" AS ENUM('account_created', 'verification_status', 'collaboration_status')`,
    );
    await queryRunner.query(
      `CREATE TABLE "vet_status_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "vetId" uuid NOT NULL,
        "type" "public"."vet_status_logs_type_enum" NOT NULL,
        "status" character varying(50),
        "reason" text,
        "actorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_vet_status_logs_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_status_logs_vetId_createdAt" ON "vet_status_logs" ("vetId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_status_logs" ADD CONSTRAINT "FK_vet_status_logs_vetId" FOREIGN KEY ("vetId") REFERENCES "vet_profiles"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_status_logs" ADD CONSTRAINT "FK_vet_status_logs_actorId" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  /**
   * The 'vet' value stays in "users_role_enum": Postgres cannot drop an enum
   * value, and it is harmless once no row uses it.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "vet_status_logs"`);
    await queryRunner.query(`DROP TYPE "public"."vet_status_logs_type_enum"`);
    await queryRunner.query(`DROP TABLE "vet_reviews"`);
    await queryRunner.query(`DROP TYPE "public"."vet_reviews_status_enum"`);
    await queryRunner.query(`DROP TABLE "vet_working_hours"`);
    await queryRunner.query(`DROP TABLE "vet_services"`);
    await queryRunner.query(`DROP TABLE "vet_documents"`);
    await queryRunner.query(`DROP TYPE "public"."vet_documents_status_enum"`);
    await queryRunner.query(`DROP TABLE "vet_profiles"`);
    await queryRunner.query(
      `DROP TYPE "public"."vet_profiles_collaborationstatus_enum"`,
    );
    await queryRunner.query(
      `DROP TYPE "public"."vet_profiles_verificationstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."vet_profiles_gender_enum"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "lastLoginAt"`);
    await queryRunner.query(`ALTER TABLE "users" DROP COLUMN "isSuspended"`);
  }
}
