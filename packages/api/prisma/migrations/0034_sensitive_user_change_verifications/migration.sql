CREATE TYPE "SensitiveUserChangeType" AS ENUM ('tier', 'role');

CREATE TABLE "sensitive_user_change_verifications" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "target_user_id" UUID NOT NULL,
    "requested_by_user_id" UUID NOT NULL,
    "change_type" "SensitiveUserChangeType" NOT NULL,
    "previous_value" VARCHAR(50) NOT NULL,
    "requested_value" VARCHAR(50) NOT NULL,
    "code_hash" VARCHAR(128) NOT NULL,
    "expires_at" TIMESTAMPTZ(3) NOT NULL,
    "used_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sensitive_user_change_verifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "sensitive_user_change_verifications_target_user_id_idx"
    ON "sensitive_user_change_verifications"("target_user_id");

CREATE INDEX "sensitive_user_change_verifications_requested_by_user_id_idx"
    ON "sensitive_user_change_verifications"("requested_by_user_id");

CREATE INDEX "sensitive_user_change_verifications_change_type_expires_at_idx"
    ON "sensitive_user_change_verifications"("change_type", "expires_at");

CREATE INDEX "sensitive_user_change_verifications_used_at_idx"
    ON "sensitive_user_change_verifications"("used_at");

ALTER TABLE "sensitive_user_change_verifications"
    ADD CONSTRAINT "sensitive_user_change_verifications_target_user_id_fkey"
    FOREIGN KEY ("target_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "sensitive_user_change_verifications"
    ADD CONSTRAINT "sensitive_user_change_verifications_requested_by_user_id_fkey"
    FOREIGN KEY ("requested_by_user_id") REFERENCES "users"("id")
    ON DELETE CASCADE ON UPDATE CASCADE;
