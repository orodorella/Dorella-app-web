-- CreateTable
CREATE TABLE "expense_categories" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "nombre" VARCHAR(120) NOT NULL,
    "afecta_resultado" BOOLEAN NOT NULL DEFAULT true,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "orden" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "expense_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "fecha" DATE NOT NULL,
    "descripcion" VARCHAR(500) NOT NULL,
    "valor" DECIMAL(15,2) NOT NULL,
    "category_id" UUID NOT NULL,
    "proveedor" VARCHAR(255),
    "medio_pago" VARCHAR(60),
    "observaciones" TEXT,
    "soporte_referencia" VARCHAR(500),
    "created_by" UUID,
    "voided_at" TIMESTAMPTZ(3),
    "void_reason" VARCHAR(500),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "expense_categories_nombre_key" ON "expense_categories"("nombre");

-- CreateIndex
CREATE INDEX "expenses_fecha_idx" ON "expenses"("fecha");

-- CreateIndex
CREATE INDEX "expenses_category_id_fecha_idx" ON "expenses"("category_id", "fecha");

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "expense_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- Integridad: valor positivo.
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_valor_positive_check" CHECK ("valor" > 0);

-- Datos de referencia: categorías iniciales (idempotente; no toca datos existentes).
-- Rollback: eliminar las tablas expenses y expense_categories.
INSERT INTO "expense_categories" ("nombre", "orden") VALUES
  ('Transporte y taxis', 1), ('Alimentación', 2), ('Vuelos', 3), ('Hospedaje', 4),
  ('Fletes y envíos', 5), ('Compras operativas', 6), ('Publicidad y marketing', 7),
  ('Servicios', 8), ('Otros', 9)
ON CONFLICT ("nombre") DO NOTHING;
