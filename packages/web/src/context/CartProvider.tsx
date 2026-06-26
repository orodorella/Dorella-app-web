'use client';

import { createContext, useContext, useReducer, type ReactNode } from 'react';
import { useAuth } from './AuthProvider';
import { TIERS } from '@/lib/tiers';

export interface CartProduct {
  id: string;
  nombre: string;
  precio: number;
  precioPublico?: number;
  stock: number;
  ref?: string;
  imagen?: string | null;
  material?: string | null;
  categoria?: string;
}

interface CartItem {
  product: CartProduct;
  cantidad: number;
}

interface CartState {
  items: CartItem[];
}

type CartAction =
  | { type: 'ADD_TO_CART'; payload: Array<{ product: CartProduct; cantidad: number }> }
  | { type: 'UPDATE_CANTIDAD'; payload: { productId: string; cantidad: number } }
  | { type: 'REMOVE_FROM_CART'; payload: string }
  | { type: 'CLEAR_CART' };

function cartReducer(state: CartState, action: CartAction): CartState {
  switch (action.type) {
    case 'ADD_TO_CART': {
      const next = [...state.items];
      for (const { product, cantidad } of action.payload) {
        if (cantidad <= 0) continue;
        const idx = next.findIndex((i) => i.product.id === product.id);
        if (idx >= 0) {
          next[idx] = { ...next[idx], cantidad: Math.min(next[idx].cantidad + cantidad, product.stock) };
        } else {
          next.push({ product, cantidad: Math.min(cantidad, product.stock) });
        }
      }
      return { items: next };
    }
    case 'UPDATE_CANTIDAD': {
      const { productId, cantidad } = action.payload;
      if (cantidad <= 0) {
        return { items: state.items.filter((i) => i.product.id !== productId) };
      }
      return {
        items: state.items.map((i) =>
          i.product.id === productId ? { ...i, cantidad: Math.min(cantidad, i.product.stock) } : i
        ),
      };
    }
    case 'REMOVE_FROM_CART':
      return { items: state.items.filter((i) => i.product.id !== action.payload) };
    case 'CLEAR_CART':
      return { items: [] };
    default:
      return state;
  }
}

interface CartContextValue {
  carrito: CartItem[];
  cartDispatch: React.Dispatch<CartAction>;
  addToCart: (items: Array<{ product: CartProduct; cantidad: number }>) => void;
  updateCantidad: (productId: string, cantidad: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  subtotalPublico: number;
  subtotalTier: number;
  ahorro: number;
  cumpleMinimo: boolean;
  totalItems: number;
  nextTier: { key: string; label: string; descuento: number; minimo: number; faltan: number } | null;
}

const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(cartReducer, { items: [] });
  const { tier, tierInfo } = useAuth();

  const addToCart = (items: Array<{ product: CartProduct; cantidad: number }>) =>
    dispatch({ type: 'ADD_TO_CART', payload: items });

  const updateCantidad = (productId: string, cantidad: number) =>
    dispatch({ type: 'UPDATE_CANTIDAD', payload: { productId, cantidad } });

  const removeFromCart = (productId: string) =>
    dispatch({ type: 'REMOVE_FROM_CART', payload: productId });

  const clearCart = () => dispatch({ type: 'CLEAR_CART' });

  const subtotalPublico = state.items.reduce(
    (sum, i) => sum + (i.product.precioPublico || i.product.precio) * i.cantidad, 0
  );
  const subtotalTier = state.items.reduce(
    (sum, i) => sum + (i.product.precio || i.product.precioPublico || 0) * (1 - tierInfo.descuento) * i.cantidad, 0
  );
  const ahorro = subtotalPublico - subtotalTier;
  const cumpleMinimo = subtotalTier >= tierInfo.minimo || tierInfo.minimo === 0;
  const totalItems = state.items.reduce((sum, i) => sum + i.cantidad, 0);

  let nextTier: CartContextValue['nextTier'] = null;
  if (tier === 'detal' && subtotalPublico > 0) {
    nextTier = { key: 'mayorista', ...TIERS.mayorista, faltan: Math.max(0, 500000 - subtotalPublico) };
  } else if (tier === 'mayorista') {
    nextTier = { key: 'granmayorista', ...TIERS.granmayorista, faltan: Math.max(0, 5000000 - subtotalTier) };
  }

  return (
    <CartContext.Provider value={{
      carrito: state.items,
      cartDispatch: dispatch,
      addToCart,
      updateCantidad,
      removeFromCart,
      clearCart,
      subtotalPublico,
      subtotalTier,
      ahorro,
      cumpleMinimo,
      totalItems,
      nextTier,
    }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
}
