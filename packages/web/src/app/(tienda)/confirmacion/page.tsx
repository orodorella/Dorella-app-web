import { redirect } from 'next/navigation';

// Legacy screen from before the Mercado Pago integration: it used to render
// "Pedido Confirmado" straight from `orden`/`total`/`items` query params,
// with no backend check. Nothing in the current checkout flow links here
// anymore (payment now returns through /pago/exitoso|pendiente|fallido,
// which verify the real state with the backend), but the route is kept
// reachable — old links/bookmarks redirect to the authoritative source of
// truth instead of trusting the URL.
export default function ConfirmacionPage() {
  redirect('/mis-pedidos');
}
