export default function ProductImage({ product, size = 'md' }) {
  const sizeClass = size === 'lg' ? 'w-24 h-24' : size === 'sm' ? 'w-12 h-12' : 'w-16 h-16'

  if (product.imagen) {
    return (
      <img
        src={product.imagen}
        alt={product.nombre}
        className={`${sizeClass} object-cover rounded-lg flex-shrink-0`}
      />
    )
  }

  return (
    <div className={`${sizeClass} bg-gradient-to-br from-stone-100 to-stone-50 rounded-lg flex items-center justify-center border border-stone-150 flex-shrink-0`}>
      <span className="text-stone-300 text-xs font-medium" style={{ fontFamily: 'var(--font-display)' }}>
        {product.ref}
      </span>
    </div>
  )
}
