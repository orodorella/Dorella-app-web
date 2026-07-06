ALTER TABLE "products" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "products" ADD COLUMN "deactivated_by" UUID;
ALTER TABLE "products" ADD CONSTRAINT "products_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_deactivated_by_fkey";

ALTER TABLE "categories" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "categories" ADD COLUMN "deactivated_by" UUID;
ALTER TABLE "categories" ADD CONSTRAINT "categories_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "categories" VALIDATE CONSTRAINT "categories_deactivated_by_fkey";

ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN "deactivated_by" UUID;
ALTER TABLE "users" ADD CONSTRAINT "users_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "users" VALIDATE CONSTRAINT "users_deactivated_by_fkey";

ALTER TABLE "catalogos" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "catalogos" ADD COLUMN "deactivated_by" UUID;
ALTER TABLE "catalogos" ADD CONSTRAINT "catalogos_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "catalogos" VALIDATE CONSTRAINT "catalogos_deactivated_by_fkey";
