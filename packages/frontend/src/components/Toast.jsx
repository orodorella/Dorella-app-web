import { CheckCircle, AlertCircle, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useApp } from '../context/AppContext'

export default function Toast() {
  const { toast, dispatch } = useApp()

  return (
    <AnimatePresence>
      {toast && (
        <motion.div
          initial={{ y: -20, opacity: 0, scale: 0.97 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -12, opacity: 0, scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 500, damping: 30 }}
          className="fixed top-20 right-6 z-50"
          role="alert"
          aria-live="polite"
        >
          <div className={`flex items-center gap-3 px-5 py-3.5 rounded-lg shadow-lg border bg-white ${
            toast.type === 'error' ? 'border-red-200 text-red-700' : 'border-emerald-200 text-emerald-700'
          }`}>
            {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle size={18} />}
            <span className="text-sm font-medium">{toast.message}</span>
            <button
              onClick={() => dispatch({ type: 'CLEAR_TOAST' })}
              className="ml-2 text-stone-300 hover:text-stone-500 cursor-pointer p-1"
              aria-label="Cerrar"
            >
              <X size={13} />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
