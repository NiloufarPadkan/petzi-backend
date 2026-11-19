import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Clinic panel: staff accounts, members, roles with permissions, patients and
 * medical records, plus a few columns on existing tables.
 */
export class CreateClinicPanelTables1787830000000 implements MigrationInterface {
  name = 'CreateClinicPanelTables1787830000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    // Role for clinic employees who are not vets. The earlier admin-panel
    // migration committed its own enum values, so this one can be added here.
    await q(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'clinic_staff'`,
    );

    await q(
      `ALTER TABLE "pets" ADD COLUMN IF NOT EXISTS "microchipNumber" character varying(30)`,
    );
    await q(
      `ALTER TABLE "clinics" ADD COLUMN IF NOT EXISTS "panelNotifications" jsonb NOT NULL DEFAULT '{}'`,
    );

    // ---- roles ----
    await q(`CREATE TABLE "clinic_roles" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "clinicId" uuid NOT NULL,
      "name" character varying(100) NOT NULL,
      "color" character varying(7),
      "permissions" jsonb NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_clinic_roles_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE UNIQUE INDEX "IDX_clinic_roles_clinic_name" ON "clinic_roles" ("clinicId", "name")`,
    );
    await q(
      `ALTER TABLE "clinic_roles" ADD CONSTRAINT "FK_clinic_roles_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ---- members ----
    await q(
      `CREATE TYPE "public"."clinic_members_membertype_enum" AS ENUM('vet', 'secretary', 'technician', 'assistant', 'other')`,
    );
    await q(`CREATE TABLE "clinic_members" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "clinicId" uuid NOT NULL,
      "userId" uuid NOT NULL,
      "roleId" uuid,
      "memberType" "public"."clinic_members_membertype_enum" NOT NULL,
      "jobTitle" character varying(100),
      "isActive" boolean NOT NULL DEFAULT true,
      "workingHours" jsonb NOT NULL DEFAULT '[]',
      "serviceIds" jsonb NOT NULL DEFAULT '[]',
      "joinedAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_clinic_members_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_clinic_members_userId" UNIQUE ("userId")
    )`);
    await q(
      `CREATE INDEX "IDX_clinic_members_clinicId" ON "clinic_members" ("clinicId")`,
    );
    await q(
      `ALTER TABLE "clinic_members" ADD CONSTRAINT "FK_clinic_members_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "clinic_members" ADD CONSTRAINT "FK_clinic_members_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "clinic_members" ADD CONSTRAINT "FK_clinic_members_roleId" FOREIGN KEY ("roleId") REFERENCES "clinic_roles"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // ---- patients ----
    await q(`CREATE TABLE "clinic_patients" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "clinicId" uuid NOT NULL,
      "petId" uuid NOT NULL,
      "vetId" uuid,
      "firstVisitAt" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
      "medicalNotes" text,
      "archivedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_clinic_patients_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE UNIQUE INDEX "IDX_clinic_patients_clinic_pet" ON "clinic_patients" ("clinicId", "petId")`,
    );
    await q(
      `ALTER TABLE "clinic_patients" ADD CONSTRAINT "FK_clinic_patients_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "clinic_patients" ADD CONSTRAINT "FK_clinic_patients_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "clinic_patients" ADD CONSTRAINT "FK_clinic_patients_vetId" FOREIGN KEY ("vetId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // ---- medical records ----
    await q(`CREATE TABLE "patient_records" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "clinicId" uuid NOT NULL,
      "petId" uuid NOT NULL,
      "vetId" uuid,
      "type" character varying(50) NOT NULL DEFAULT 'visit',
      "title" character varying(200) NOT NULL,
      "recordedAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "result" text,
      "aiSummary" text,
      "images" jsonb NOT NULL DEFAULT '[]',
      "prescriptions" jsonb NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_patient_records_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_patient_records_clinic_pet_time" ON "patient_records" ("clinicId", "petId", "recordedAt")`,
    );
    await q(
      `ALTER TABLE "patient_records" ADD CONSTRAINT "FK_patient_records_clinicId" FOREIGN KEY ("clinicId") REFERENCES "clinics"("userId") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "patient_records" ADD CONSTRAINT "FK_patient_records_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "patient_records" ADD CONSTRAINT "FK_patient_records_vetId" FOREIGN KEY ("vetId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);
    await q(`DROP TABLE "patient_records"`);
    await q(`DROP TABLE "clinic_patients"`);
    await q(`DROP TABLE "clinic_members"`);
    await q(`DROP TYPE "public"."clinic_members_membertype_enum"`);
    await q(`DROP TABLE "clinic_roles"`);
    await q(`ALTER TABLE "clinics" DROP COLUMN "panelNotifications"`);
    await q(`ALTER TABLE "pets" DROP COLUMN "microchipNumber"`);
    // The 'clinic_staff' enum value cannot be removed from users_role_enum.
  }
}
