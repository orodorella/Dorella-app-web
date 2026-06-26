import { useState } from 'react'
import { Settings } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function FacilitadorSwitch() {
  const { user, tier, dispatch, TIERS } = useApp()
  const [open, setOpen] = useState(false)

  if (!user) return null

  return (
    <div className="fixed bottom-6 right-6 z-50">
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.95 }}
            className="mb-3 bg-white rounded-lg shadow-xl border border-stone-200 p-4 min-w-[210px]"
          >
            <p className="text-[9px] uppercase tracking-[0.2em] text-stone-400 mb-3 font-semibold">
              Cambiar Tier
            </p>
            {Object.entries(TIERS).map(([key, info]) => (
              <button
                key={key}
                onClick={() => { dispatch({ type: 'SET_TIER', payload: key }); setOpen(false) }}
                className={`w-full text-left px-3 py-2 rounded-md text-sm transition-colors cursor-pointer mb-0.5 ${
                  tier === key ? 'bg-wine text-white' : 'text-stone-600 hover:bg-stone-50'
                }`}
              >
                {info.label}
                {info.descuento > 0 && (
                  <span className="text-xs ml-2 opacity-60">({(info.descuento * 100).toFixed(1)}%)</span>
                )}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        onClick={() => setOpen(!open)}
        className="bg-wine text-white p-3 rounded-full shadow-lg hover:bg-wine-light transition-colors cursor-pointer"
        aria-label="Panel de facilitador"
      >
        <Settings size={18} className={open ? 'animate-spin' : ''} />
      </motion.button>
    </div>
  )
}
