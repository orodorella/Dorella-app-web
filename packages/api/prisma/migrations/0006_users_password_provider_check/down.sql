ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_password_required_for_email";
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "provider";
