ALTER TABLE "users" ADD COLUMN "provider" VARCHAR(20) NOT NULL DEFAULT 'email';
ALTER TABLE "users" ALTER COLUMN "password_hash" DROP NOT NULL;

ALTER TABLE "users" ADD CONSTRAINT "users_password_required_for_email"
  CHECK ("provider" <> 'email' OR "password_hash" IS NOT NULL) NOT VALID;
ALTER TABLE "users" VALIDATE CONSTRAINT "users_password_required_for_email";
