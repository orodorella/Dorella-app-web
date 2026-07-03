ALTER TABLE "catalogos" DROP CONSTRAINT IF EXISTS "catalogos_deactivated_by_fkey";
ALTER TABLE "catalogos" DROP COLUMN IF EXISTS "deactivated_by";
ALTER TABLE "catalogos" DROP COLUMN IF EXISTS "deactivated_at";

ALTER TABLE "users" DROP CONSTRAINT IF EXISTS "users_deactivated_by_fkey";
ALTER TABLE "users" DROP COLUMN IF EXISTS "deactivated_by";
ALTER TABLE "users" DROP COLUMN IF EXISTS "deactivated_at";

ALTER TABLE "categories" DROP CONSTRAINT IF EXISTS "categories_deactivated_by_fkey";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "deactivated_by";
ALTER TABLE "categories" DROP COLUMN IF EXISTS "deactivated_at";

ALTER TABLE "products" DROP CONSTRAINT IF EXISTS "products_deactivated_by_fkey";
ALTER TABLE "products" DROP COLUMN IF EXISTS "deactivated_by";
ALTER TABLE "products" DROP COLUMN IF EXISTS "deactivated_at";
