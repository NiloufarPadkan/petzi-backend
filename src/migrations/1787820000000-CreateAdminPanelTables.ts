import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Admin panel: premium plans, settings, support (tickets + FAQ), messages,
 * reservations, payments and petshop/shelter accounts.
 */
export class CreateAdminPanelTables1787820000000 implements MigrationInterface {
  name = 'CreateAdminPanelTables1787820000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    // Roles for the new account types (not used until this migration commits).
    await q(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'petshop'`,
    );
    await q(
      `ALTER TYPE "public"."users_role_enum" ADD VALUE IF NOT EXISTS 'shelter'`,
    );

    // ---- premium plans ----
    await q(`CREATE TABLE "premium_plans" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "name" character varying(100) NOT NULL,
      "description" text,
      "isActive" boolean NOT NULL DEFAULT true,
      "color" character varying(7),
      "icon" character varying(50),
      "badge" character varying(50),
      "basePrice" integer NOT NULL,
      "periods" jsonb NOT NULL DEFAULT '[]',
      "features" jsonb NOT NULL DEFAULT '[]',
      "sortOrder" integer NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_premium_plans_id" PRIMARY KEY ("id")
    )`);
    await q(
      `ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "planId" uuid`,
    );
    await q(
      `CREATE INDEX "IDX_subscriptions_planId" ON "subscriptions" ("planId")`,
    );
    await q(
      `ALTER TABLE "subscriptions" ADD CONSTRAINT "FK_subscriptions_planId" FOREIGN KEY ("planId") REFERENCES "premium_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // ---- system settings ----
    await q(`CREATE TABLE "system_settings" (
      "group" character varying(50) NOT NULL,
      "values" jsonb NOT NULL DEFAULT '{}',
      "updatedById" uuid,
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_system_settings_group" PRIMARY KEY ("group")
    )`);

    // ---- support ----
    await q(
      `CREATE TYPE "public"."support_tickets_priority_enum" AS ENUM('low', 'normal', 'high')`,
    );
    await q(
      `CREATE TYPE "public"."support_tickets_status_enum" AS ENUM('open', 'in_progress', 'resolved', 'closed')`,
    );
    await q(`CREATE TABLE "support_tickets" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "number" SERIAL NOT NULL,
      "creatorId" uuid,
      "subject" character varying(200) NOT NULL,
      "category" character varying(100) NOT NULL DEFAULT 'general',
      "description" text NOT NULL,
      "priority" "public"."support_tickets_priority_enum" NOT NULL DEFAULT 'normal',
      "status" "public"."support_tickets_status_enum" NOT NULL DEFAULT 'open',
      "adminResponse" text,
      "resolvedAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_support_tickets_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_support_tickets_status" ON "support_tickets" ("status")`,
    );
    await q(
      `CREATE INDEX "IDX_support_tickets_creatorId" ON "support_tickets" ("creatorId")`,
    );
    await q(
      `ALTER TABLE "support_tickets" ADD CONSTRAINT "FK_support_tickets_creatorId" FOREIGN KEY ("creatorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await q(`CREATE TABLE "faq_items" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "question" character varying(300) NOT NULL,
      "answer" text NOT NULL,
      "sortOrder" integer NOT NULL DEFAULT 0,
      "isPublished" boolean NOT NULL DEFAULT true,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_faq_items_id" PRIMARY KEY ("id")
    )`);

    // ---- messages ----
    await q(`CREATE TABLE "conversations" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "userId" uuid NOT NULL,
      "lastMessageAt" TIMESTAMP WITH TIME ZONE,
      "lastMessagePreview" character varying(200),
      "unreadByAdmin" integer NOT NULL DEFAULT 0,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_conversations_id" PRIMARY KEY ("id"),
      CONSTRAINT "UQ_conversations_userId" UNIQUE ("userId")
    )`);
    await q(
      `CREATE INDEX "IDX_conversations_lastMessageAt" ON "conversations" ("lastMessageAt")`,
    );
    await q(
      `ALTER TABLE "conversations" ADD CONSTRAINT "FK_conversations_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `CREATE TYPE "public"."chat_messages_senderrole_enum" AS ENUM('admin', 'user')`,
    );
    await q(`CREATE TABLE "chat_messages" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "conversationId" uuid NOT NULL,
      "senderRole" "public"."chat_messages_senderrole_enum" NOT NULL,
      "senderId" uuid,
      "body" text NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_chat_messages_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_chat_messages_conversation" ON "chat_messages" ("conversationId", "createdAt")`,
    );
    await q(
      `ALTER TABLE "chat_messages" ADD CONSTRAINT "FK_chat_messages_conversationId" FOREIGN KEY ("conversationId") REFERENCES "conversations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ---- reservations ----
    await q(
      `CREATE TYPE "public"."reservations_status_enum" AS ENUM('pending', 'confirmed', 'completed', 'cancelled', 'no_show')`,
    );
    await q(`CREATE TABLE "reservations" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "number" SERIAL NOT NULL,
      "ownerId" uuid NOT NULL,
      "petId" uuid,
      "vetId" uuid,
      "clinicId" uuid,
      "serviceName" character varying(150) NOT NULL,
      "serviceDescription" text,
      "scheduledAt" TIMESTAMP WITH TIME ZONE NOT NULL,
      "durationMinutes" integer NOT NULL DEFAULT 30,
      "status" "public"."reservations_status_enum" NOT NULL DEFAULT 'pending',
      "price" integer NOT NULL DEFAULT 0,
      "clinicNote" text,
      "cancelReason" text,
      "cancelledAt" TIMESTAMP WITH TIME ZONE,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_reservations_id" PRIMARY KEY ("id")
    )`);
    await q(`ALTER SEQUENCE "reservations_number_seq" RESTART WITH 10001`);
    await q(
      `CREATE INDEX "IDX_reservations_ownerId" ON "reservations" ("ownerId")`,
    );
    await q(
      `CREATE INDEX "IDX_reservations_vet_time" ON "reservations" ("vetId", "scheduledAt")`,
    );
    await q(
      `CREATE INDEX "IDX_reservations_clinic_time" ON "reservations" ("clinicId", "scheduledAt")`,
    );
    await q(
      `CREATE INDEX "IDX_reservations_status_time" ON "reservations" ("status", "scheduledAt")`,
    );
    await q(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_reservations_ownerId" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_reservations_petId" FOREIGN KEY ("petId") REFERENCES "pets"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_reservations_vetId" FOREIGN KEY ("vetId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "reservations" ADD CONSTRAINT "FK_reservations_clinicId" FOREIGN KEY ("clinicId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await q(`CREATE TABLE "reservation_notes" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "reservationId" uuid NOT NULL,
      "authorId" uuid,
      "text" text NOT NULL,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_reservation_notes_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_reservation_notes_reservation" ON "reservation_notes" ("reservationId", "createdAt")`,
    );
    await q(
      `ALTER TABLE "reservation_notes" ADD CONSTRAINT "FK_reservation_notes_reservationId" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "reservation_notes" ADD CONSTRAINT "FK_reservation_notes_authorId" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    await q(`CREATE TABLE "reservation_events" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "reservationId" uuid NOT NULL,
      "type" character varying(50) NOT NULL,
      "message" text NOT NULL,
      "actorId" uuid,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_reservation_events_id" PRIMARY KEY ("id")
    )`);
    await q(
      `CREATE INDEX "IDX_reservation_events_reservation" ON "reservation_events" ("reservationId", "createdAt")`,
    );
    await q(
      `ALTER TABLE "reservation_events" ADD CONSTRAINT "FK_reservation_events_reservationId" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );

    // ---- payments ----
    await q(
      `CREATE TYPE "public"."payments_purpose_enum" AS ENUM('reservation', 'subscription')`,
    );
    await q(
      `CREATE TYPE "public"."payments_method_enum" AS ENUM('online', 'cash', 'wallet')`,
    );
    await q(
      `CREATE TYPE "public"."payments_status_enum" AS ENUM('pending', 'success', 'failed', 'refunded')`,
    );
    await q(`CREATE TABLE "payments" (
      "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
      "number" SERIAL NOT NULL,
      "userId" uuid,
      "reservationId" uuid,
      "planId" uuid,
      "purpose" "public"."payments_purpose_enum" NOT NULL DEFAULT 'reservation',
      "amount" integer NOT NULL,
      "discount" integer NOT NULL DEFAULT 0,
      "gatewayFee" integer NOT NULL DEFAULT 0,
      "finalAmount" integer NOT NULL,
      "method" "public"."payments_method_enum" NOT NULL DEFAULT 'online',
      "gateway" character varying(50),
      "status" "public"."payments_status_enum" NOT NULL DEFAULT 'pending',
      "gatewayReference" character varying(100),
      "rrn" character varying(100),
      "isSettled" boolean NOT NULL DEFAULT false,
      "paidAt" TIMESTAMP WITH TIME ZONE,
      "refundedAmount" integer NOT NULL DEFAULT 0,
      "refundedAt" TIMESTAMP WITH TIME ZONE,
      "refundReason" text,
      "timeline" jsonb NOT NULL DEFAULT '[]',
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_payments_id" PRIMARY KEY ("id"),
      CONSTRAINT "CHK_payments_refund" CHECK ("refundedAmount" >= 0 AND "refundedAmount" <= "finalAmount")
    )`);
    await q(`ALTER SEQUENCE "payments_number_seq" RESTART WITH 100001`);
    await q(`CREATE INDEX "IDX_payments_userId" ON "payments" ("userId")`);
    await q(
      `CREATE INDEX "IDX_payments_reservationId" ON "payments" ("reservationId")`,
    );
    await q(
      `CREATE INDEX "IDX_payments_status_createdAt" ON "payments" ("status", "createdAt")`,
    );
    await q(`CREATE INDEX "IDX_payments_planId" ON "payments" ("planId")`);
    await q(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_reservationId" FOREIGN KEY ("reservationId") REFERENCES "reservations"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );
    await q(
      `ALTER TABLE "payments" ADD CONSTRAINT "FK_payments_planId" FOREIGN KEY ("planId") REFERENCES "premium_plans"("id") ON DELETE SET NULL ON UPDATE NO ACTION`,
    );

    // ---- petshops & shelters ----
    await q(
      `CREATE TYPE "public"."organizations_kind_enum" AS ENUM('petshop', 'shelter')`,
    );
    await q(
      `CREATE TYPE "public"."organizations_verificationstatus_enum" AS ENUM('pending', 'approved', 'rejected', 'needs_edit')`,
    );
    await q(
      `CREATE TYPE "public"."organizations_activitystatus_enum" AS ENUM('active', 'inactive', 'suspended')`,
    );
    await q(`CREATE TABLE "organizations" (
      "userId" uuid NOT NULL,
      "kind" "public"."organizations_kind_enum" NOT NULL,
      "name" character varying(150) NOT NULL,
      "about" text,
      "licenseNumber" character varying(50),
      "phone" character varying(20) NOT NULL,
      "secondaryPhone" character varying(20),
      "website" character varying(200),
      "instagram" character varying(200),
      "province" character varying(100) NOT NULL,
      "city" character varying(100) NOT NULL,
      "address" text NOT NULL,
      "latitude" numeric(10,7),
      "longitude" numeric(10,7),
      "logoUrl" character varying,
      "photos" jsonb NOT NULL DEFAULT '[]',
      "shifts" jsonb NOT NULL DEFAULT '[]',
      "categories" jsonb NOT NULL DEFAULT '[]',
      "services" jsonb NOT NULL DEFAULT '[]',
      "animals" jsonb NOT NULL DEFAULT '[]',
      "capacity" integer,
      "verificationStatus" "public"."organizations_verificationstatus_enum" NOT NULL DEFAULT 'pending',
      "activityStatus" "public"."organizations_activitystatus_enum" NOT NULL DEFAULT 'active',
      "adminNotes" text,
      "createdAt" TIMESTAMP NOT NULL DEFAULT now(),
      "updatedAt" TIMESTAMP NOT NULL DEFAULT now(),
      CONSTRAINT "PK_organizations_userId" PRIMARY KEY ("userId")
    )`);
    await q(
      `CREATE INDEX "IDX_organizations_kind_verification" ON "organizations" ("kind", "verificationStatus")`,
    );
    await q(
      `CREATE INDEX "IDX_organizations_kind_city" ON "organizations" ("kind", "city")`,
    );
    await q(
      `ALTER TABLE "organizations" ADD CONSTRAINT "FK_organizations_userId" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE NO ACTION`,
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const q = (sql: string) => queryRunner.query(sql);

    await q(`DROP TABLE "organizations"`);
    await q(`DROP TYPE "public"."organizations_activitystatus_enum"`);
    await q(`DROP TYPE "public"."organizations_verificationstatus_enum"`);
    await q(`DROP TYPE "public"."organizations_kind_enum"`);

    await q(`DROP TABLE "payments"`);
    await q(`DROP TYPE "public"."payments_status_enum"`);
    await q(`DROP TYPE "public"."payments_method_enum"`);
    await q(`DROP TYPE "public"."payments_purpose_enum"`);

    await q(`DROP TABLE "reservation_events"`);
    await q(`DROP TABLE "reservation_notes"`);
    await q(`DROP TABLE "reservations"`);
    await q(`DROP TYPE "public"."reservations_status_enum"`);

    await q(`DROP TABLE "chat_messages"`);
    await q(`DROP TYPE "public"."chat_messages_senderrole_enum"`);
    await q(`DROP TABLE "conversations"`);

    await q(`DROP TABLE "faq_items"`);
    await q(`DROP TABLE "support_tickets"`);
    await q(`DROP TYPE "public"."support_tickets_status_enum"`);
    await q(`DROP TYPE "public"."support_tickets_priority_enum"`);

    await q(`DROP TABLE "system_settings"`);

    await q(
      `ALTER TABLE "subscriptions" DROP CONSTRAINT "FK_subscriptions_planId"`,
    );
    await q(`DROP INDEX "public"."IDX_subscriptions_planId"`);
    await q(`ALTER TABLE "subscriptions" DROP COLUMN "planId"`);
    await q(`DROP TABLE "premium_plans"`);
    // Enum values 'petshop'/'shelter' cannot be removed from users_role_enum.
  }
}
