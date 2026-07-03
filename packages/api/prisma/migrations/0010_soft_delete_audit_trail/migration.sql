ALTER TABLE "products" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "products" ADD COLUMN "deactivated_by" UUID;
CREATE INDEX CONCURRENTLY "products_deactivated_by_idx" ON "products"("deactivated_by");
ALTER TABLE "products" ADD CONSTRAINT "products_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "products" VALIDATE CONSTRAINT "products_deactivated_by_fkey";

ALTER TABLE "categories" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "categories" ADD COLUMN "deactivated_by" UUID;
CREATE INDEX CONCURRENTLY "categories_deactivated_by_idx" ON "categories"("deactivated_by");
ALTER TABLE "categories" ADD CONSTRAINT "categories_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "categories" VALIDATE CONSTRAINT "categories_deactivated_by_fkey";

ALTER TABLE "users" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "users" ADD COLUMN "deactivated_by" UUID;
CREATE INDEX CONCURRENTLY "users_deactivated_by_idx" ON "users"("deactivated_by");
ALTER TABLE "users" ADD CONSTRAINT "users_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "users" VALIDATE CONSTRAINT "users_deactivated_by_fkey";

ALTER TABLE "catalogos" ADD COLUMN "deactivated_at" TIMESTAMPTZ(3);
ALTER TABLE "catalogos" ADD COLUMN "deactivated_by" UUID;
CREATE INDEX CONCURRENTLY "catalogos_deactivated_by_idx" ON "catalogos"("deactivated_by");
ALTER TABLE "catalogos" ADD CONSTRAINT "catalogos_deactivated_by_fkey"
  FOREIGN KEY ("deactivated_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE NOT VALID;
ALTER TABLE "catalogos" VALIDATE CONSTRAINT "catalogos_deactivated_by_fkey";
