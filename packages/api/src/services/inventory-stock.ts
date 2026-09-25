import { Prisma } from '@prisma/client';

export interface InventoryDelta {
  productId: string;
  /** Cambio sobre `stock` (negativo = descontar). */
  stock?: number;
  /** Cambio sobre `stock_reservado` (negativo = liberar). */
  reserved?: number;
}

/**
 * Aplica todos los cambios de inventario de una operación en UNA sola sentencia,
 * sin importar cuántos productos tenga el pedido.
 *
 * Reemplaza los bucles de `tx.product.update` por producto: cada iteración era un
 * viaje de red Railway → pooler de Supabase dentro de una transacción interactiva,
 * y en pedidos con muchos productos la transacción superaba el timeout de Prisma
 * (5 s) a mitad del bucle → P2028 "Transaction not found" en `product.update()`.
 *
 * Debe ejecutarse dentro de una transacción que ya bloqueó las filas con
 * `SELECT … ORDER BY id FOR UPDATE` (lockProducts), lo que mantiene el orden de
 * bloqueo entre operaciones concurrentes.
 *
 * El `WHERE` solo actualiza una fila si el resultado sigue siendo válido: stock ≥ 0,
 * reservado ≥ 0 y reservado ≤ stock (las mismas reglas que los CHECK de la BD).
 * Devuelve `false` si algún producto no existe o no cumple la condición; el
 * llamador DEBE lanzar un error para que la transacción revierta todo.
 */
export async function applyInventoryDeltas(
  tx: Prisma.TransactionClient,
  deltas: InventoryDelta[],
): Promise<boolean> {
  const merged = new Map<string, { stock: number; reserved: number }>();
  for (const delta of deltas) {
    const current = merged.get(delta.productId) ?? { stock: 0, reserved: 0 };
    current.stock += delta.stock ?? 0;
    current.reserved += delta.reserved ?? 0;
    merged.set(delta.productId, current);
  }
  const entries = [...merged.entries()]
    .filter(([, delta]) => delta.stock !== 0 || delta.reserved !== 0)
    .sort(([a], [b]) => a.localeCompare(b));
  if (entries.length === 0) return true;

  const values = Prisma.join(
    entries.map(([productId, delta]) => Prisma.sql`(${productId}::uuid, ${delta.stock}::int, ${delta.reserved}::int)`),
  );
  const updated = await tx.$executeRaw(Prisma.sql`
    UPDATE products AS p
    SET stock = p.stock + v.stock_delta,
        stock_reservado = p.stock_reservado + v.reserved_delta,
        updated_at = now()
    FROM (VALUES ${values}) AS v(id, stock_delta, reserved_delta)
    WHERE p.id = v.id
      AND p.stock + v.stock_delta >= 0
      AND p.stock_reservado + v.reserved_delta >= 0
      AND p.stock_reservado + v.reserved_delta <= p.stock + v.stock_delta
  `);
  return updated === entries.length;
}
