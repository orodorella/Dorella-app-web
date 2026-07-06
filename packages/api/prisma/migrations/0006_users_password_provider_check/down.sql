DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM "users" WHERE "password_hash" IS NULL) THEN
    RAISE EXCEPTION 'Cannot roll back 0006: % user(s) have NULL password_hash (OAuth-only accounts). Resolve manually before reverting this migration.', (SELECT count(*) FROM "users" WHERE "password_hash" IS NULL);
  END IF;
END $$;

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_password_required_for_email";
ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "provider";
