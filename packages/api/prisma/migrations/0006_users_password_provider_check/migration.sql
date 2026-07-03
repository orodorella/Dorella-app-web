ALTER TABLE "users" ADD CONSTRAINT "users_password_required_for_email"
  CHECK ("provider" <> 'email' OR "password_hash" IS NOT NULL) NOT VALID;
ALTER TABLE "users" VALIDATE CONSTRAINT "users_password_required_for_email";
