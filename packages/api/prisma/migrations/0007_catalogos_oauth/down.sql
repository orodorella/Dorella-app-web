ALTER TABLE "users" ALTER COLUMN "password_hash" SET NOT NULL;
ALTER TABLE "users" DROP COLUMN "provider";

DROP TABLE IF EXISTS "catalogo_productos";
DROP TABLE IF EXISTS "catalogos";
