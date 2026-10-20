CREATE TYPE "public"."approval_status" AS ENUM('pending', 'approved', 'suspended');--> statement-breakpoint
CREATE TYPE "public"."member_role" AS ENUM('member', 'admin');--> statement-breakpoint
CREATE TABLE "application_sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"member_id" uuid NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "members" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"oidc_issuer" text NOT NULL,
	"oidc_subject" text NOT NULL,
	"display_name" text NOT NULL,
	"verified_email" text,
	"nickname" text DEFAULT '' NOT NULL,
	"thai_name" text DEFAULT '' NOT NULL,
	"department" text DEFAULT '' NOT NULL,
	"profile_completed_at" timestamp with time zone,
	"policy_version" text,
	"policy_accepted_at" timestamp with time zone,
	"status" "approval_status" DEFAULT 'pending' NOT NULL,
	"role" "member_role" DEFAULT 'member' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_login_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "application_sessions" ADD CONSTRAINT "application_sessions_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "application_sessions_member" ON "application_sessions" USING btree ("member_id");--> statement-breakpoint
CREATE UNIQUE INDEX "members_oidc_identity" ON "members" USING btree ("oidc_issuer","oidc_subject");