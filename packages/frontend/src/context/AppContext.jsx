import { createContext, useContext, useReducer, useCallback, useEffect, useState } from 'react'
import { auth, clearAccessToken, onLogout, TIER_MAP } from '../services/api'

const AppContext = createContext(null)

const TIERS = {
  detal: { label: 'Detal / Visitante', descuento: 0, minimo: 0 },
  mayorista: { label: 'Por Mayor', descuento: 0.375, minimo: 500000 },
  granmayorista: { label: 'Gran Mayor', descuento: 0.5, minimo: 5000000 },
}

const initialState = {
  user: null,
  carrito: [],
  toast: null,
}

function reducer(state, action) {
  switch (action.type) {
    case 'LOGIN':
      return { ...state, user: action.payload }
    case 'LOGOUT':
      return { ...initialState }
    case 'SET_TIER': {
      if (!state.user) return state
      const tierInfo = TIERS[action.payload]
      return {
        ...state,
        user: { ...state.user, tier: action.payload, ...tierInfo },
      }
    }
    case 'ADD_TO_CART': {
      const items = action.payload
      const next = [...state.carrito]
      for (const { product, cantidad } of items) {
        if (cantidad <= 0) continue
        const idx = next.findIndex((i) => i.product.id === product.id)
        if (idx >= 0) {
          next[idx] = { ...next[idx], cantidad: Math.min(next[idx].cantidad + cantidad, product.stock) }
        } else {
          next.push({ product, cantidad: Math.min(cantidad, product.stock) })
        }
      }
      return { ...state, carrito: next }
    }
    case 'UPDATE_CANTIDAD': {
      const { productId, cantidad } = action.payload
      if (cantidad <= 0) {
        return { ...state, carrito: state.carrito.filter((i) => i.product.id !== productId) }
      }
      return {
        ...state,
        carrito: state.carrito.map((i) =>
          i.product.id === productId ? { ...i, cantidad: Math.min(cantidad, i.product.stock) } : i
        ),
      }
    }
    case 'REMOVE_FROM_CART':
      return { ...state, carrito: state.carrito.filter((i) => i.product.id !== action.payload) }
    case 'CLEAR_CART':
      return { ...state, carrito: [] }
    case 'TOAST':
      return { ...state, toast: action.payload }
    case 'CLEAR_TOAST':
      return { ...state, toast: null }
    default:
      return state
  }
}

export function AppProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  const [restoring, setRestoring] = useState(true)

  useEffect(() => {
    onLogout(() => {
      clearAccessToken()
      dispatch({ type: 'LOGOUT' })
    })

    auth.me().then((user) => {
      if (user) dispatch({ type: 'LOGIN', payload: user })
    }).catch(() => {}).finally(() => setRestoring(false))
  }, [])

  const showToast = useCallback((message, type = 'success') => {
    dispatch({ type: 'TOAST', payload: { message, type } })
    setTimeout(() => dispatch({ type: 'CLEAR_TOAST' }), 3500)
  }, [])

  const tier = state.user?.tier || 'detal'
  const tierInfo = TIERS[tier]

  const subtotalPublico = state.carrito.reduce(
    (sum, i) => sum + (i.product.precioPublico || i.product.precio) * i.cantidad, 0
  )
  const subtotalTier = state.carrito.reduce(
    (sum, i) => sum + (i.product.precio || i.product.precioPublico) * (1 - tierInfo.descuento) * i.cantidad, 0
  )
  const ahorro = subtotalPublico - subtotalTier
  const cumpleMinimo = subtotalTier >= tierInfo.minimo || tierInfo.minimo === 0
  const totalItems = state.carrito.reduce((sum, i) => sum + i.cantidad, 0)

  let nextTier = null
  if (tier === 'detal' && subtotalPublico > 0) {
    nextTier = { key: 'mayorista', ...TIERS.mayorista, faltan: Math.max(0, 500000 - subtotalPublico) }
  } else if (tier === 'mayorista') {
    nextTier = { key: 'granmayorista', ...TIERS.granmayorista, faltan: Math.max(0, 5000000 - subtotalTier) }
  }

  if (restoring) return null

  return (
    <AppContext.Provider
      value={{
        ...state,
        dispatch,
        showToast,
        tier,
        tierInfo,
        TIERS,
        subtotalPublico,
        subtotalTier,
        ahorro,
        cumpleMinimo,
        totalItems,
        nextTier,
      }}
    >
      {children}
    </AppContext.Provider>
  )
}

export function useApp() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
