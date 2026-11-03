import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateClinics1787770000000 implements MigrationInterface {
  name = 'CreateClinics1787770000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'clinic'`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."clinics_type_enum" AS ENUM('clinic', 'hospital', 'specialty_clinic')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clinics_verificationstatus_enum" AS ENUM('pending', 'approved', 'rejected', 'needs_edit')`,
    );
    await queryRunner.query(
      `CREATE TYPE "public"."clinics_activitystatus_enum" AS ENUM('active', 'inactive', 'suspended')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clinics" (
        "userId" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "type" "public"."clinics_type_enum" NOT NULL,
        "about" text,
        "licenseNumber" character varying(50),
        "registrationNumber" character varying(50),
        "foundedAt" date,
        "brandColor" character varying(7),
        "staffCount" integer NOT NULL DEFAULT 0,
        "phone" character varying(20) NOT NULL,
        "secondaryPhone" character varying(20),
        "website" character varying(200),
        "instagram" character varying(200),
        "province" character varying(100) NOT NULL,
        "city" character varying(100) NOT NULL,
        "postalCode" character varying(10),
        "address" text NOT NULL,
        "latitude" numeric(10,7),
        "longitude" numeric(10,7),
        "logoUrl" character varying,
        "coverImageUrl" character varying,
        "acceptsOnlineBooking" boolean NOT NULL DEFAULT true,
        "isListedInSearch" boolean NOT NULL DEFAULT true,
        "bookingCutoffHours" integer NOT NULL DEFAULT 2,
        "verificationStatus" "public"."clinics_verificationstatus_enum" NOT NULL DEFAULT 'pending',
        "activityStatus" "public"."clinics_activitystatus_enum" NOT NULL DEFAULT 'active',
        "adminNotes" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinics_userId" PRIMARY KEY ("userId")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clinics_verificationStatus" ON "clinics" ("verificationStatus")`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clinics_city" ON "clinics" ("city")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinics" ADD CONSTRAINT "FK_clinics_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "clinic_services" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinicId" uuid NOT NULL,
        "name" character varying(150) NOT NULL,
        "category" character varying(100) NOT NULL,
        "basePrice" integer NOT NULL,
        "durationMinutes" integer NOT NULL,
        "isActive" boolean NOT NULL DEFAULT true,
        "description" text,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinic_services_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clinic_services_clinicId" ON "clinic_services" ("clinicId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_services" ADD CONSTRAINT "FK_clinic_services_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TABLE "clinic_working_hours" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinicId" uuid NOT NULL,
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
        CONSTRAINT "UQ_clinic_working_hours_clinicId_dayOfWeek" UNIQUE ("clinicId", "dayOfWeek"),
        CONSTRAINT "PK_clinic_working_hours_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_working_hours" ADD CONSTRAINT "FK_clinic_working_hours_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."clinic_images_category_enum" AS ENUM('exterior', 'interior', 'equipment', 'staff')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clinic_images" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinicId" uuid NOT NULL,
        "title" character varying(150) NOT NULL,
        "category" "public"."clinic_images_category_enum" NOT NULL,
        "fileUrl" character varying NOT NULL,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinic_images_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clinic_images_clinicId_category" ON "clinic_images" ("clinicId", "category")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_images" ADD CONSTRAINT "FK_clinic_images_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."clinic_reviews_status_enum" AS ENUM('pending', 'approved', 'rejected')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clinic_reviews" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinicId" uuid NOT NULL,
        "authorId" uuid,
        "rating" smallint NOT NULL,
        "comment" text NOT NULL,
        "reply" text,
        "repliedAt" TIMESTAMP WITH TIME ZONE,
        "status" "public"."clinic_reviews_status_enum" NOT NULL DEFAULT 'pending',
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinic_reviews_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clinic_reviews_clinicId_status" ON "clinic_reviews" ("clinicId", "status")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_reviews" ADD CONSTRAINT "FK_clinic_reviews_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_reviews" ADD CONSTRAINT "FK_clinic_reviews_authorId" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(
      `CREATE TYPE "public"."clinic_logs_type_enum" AS ENUM('account_created', 'verification_status', 'activity_status', 'schedule_changed')`,
    );
    await queryRunner.query(
      `CREATE TABLE "clinic_logs" (
        "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
        "clinicId" uuid NOT NULL,
        "type" "public"."clinic_logs_type_enum" NOT NULL,
        "status" character varying(50),
        "reason" text,
        "actorId" uuid,
        "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
        CONSTRAINT "PK_clinic_logs_id" PRIMARY KEY ("id")
      )`,
    );
    await queryRunner.query(
      `CREATE INDEX "IDX_clinic_logs_clinicId_createdAt" ON "clinic_logs" ("clinicId", "createdAt")`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_logs" ADD CONSTRAINT "FK_clinic_logs_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await queryRunner.query(
      `ALTER TABLE "clinic_logs" ADD CONSTRAINT "FK_clinic_logs_actorId" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await queryRunner.query(`ALTER TABLE "vet_profiles" ADD "clinicId" uuid`);
    await queryRunner.query(
      `CREATE INDEX "IDX_vet_profiles_clinicId" ON "vet_profiles" ("clinicId")`,
    );
    await queryRunner.query(
      `ALTER TABLE "vet_profiles" ADD CONSTRAINT "FK_vet_profiles_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  /**
   * The 'clinic' value stays in "users_role_enum": Postgres cannot drop an
   * enum value, and it is harmless once no row uses it.
   */
  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(
      `ALTER TABLE "vet_profiles" DROP CONSTRAINT "FK_vet_profiles_clinicId"`,
    );
    await queryRunner.query(`DROP INDEX "public"."IDX_vet_profiles_clinicId"`);
    await queryRunner.query(
      `ALTER TABLE "vet_profiles" DROP COLUMN "clinicId"`,
    );

    await queryRunner.query(`DROP TABLE "clinic_logs"`);
    await queryRunner.query(`DROP TYPE "public"."clinic_logs_type_enum"`);
    await queryRunner.query(`DROP TABLE "clinic_reviews"`);
    await queryRunner.query(`DROP TYPE "public"."clinic_reviews_status_enum"`);
    await queryRunner.query(`DROP TABLE "clinic_images"`);
    await queryRunner.query(`DROP TYPE "public"."clinic_images_category_enum"`);
    await queryRunner.query(`DROP TABLE "clinic_working_hours"`);
    await queryRunner.query(`DROP TABLE "clinic_services"`);
    await queryRunner.query(`DROP TABLE "clinics"`);
    await queryRunner.query(`DROP TYPE "public"."clinics_activitystatus_enum"`);
    await queryRunner.query(
      `DROP TYPE "public"."clinics_verificationstatus_enum"`,
    );
    await queryRunner.query(`DROP TYPE "public"."clinics_type_enum"`);
  }
}
