const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

// Minimal line-art glyphs, one per consumer-facing category. Kept deliberately
// simple (thin stroke, no fill) so they read as an elegant mark rather than a
// literal product photo — consistent quality regardless of catalog photography.
export function EarringIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <circle cx="12" cy="7" r="2.4" />
      <path d="M12 9.4v3.2c0 2.6 2 4.8 4.6 4.8" />
      <circle cx="16.8" cy="18.2" r="1.4" />
    </svg>
  );
}

export function ChainIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <ellipse cx="8" cy="7.5" rx="2.6" ry="1.8" transform="rotate(-30 8 7.5)" />
      <ellipse cx="12.6" cy="9.6" rx="2.6" ry="1.8" transform="rotate(-30 12.6 9.6)" />
      <ellipse cx="17.2" cy="11.7" rx="2.6" ry="1.8" transform="rotate(-30 17.2 11.7)" />
    </svg>
  );
}

export function PendantIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <circle cx="12" cy="6" r="1.6" />
      <path d="M12 7.6v2.4" />
      <path d="M8.4 17.6 12 10l3.6 7.6a4 4 0 0 1-7.2 0Z" />
    </svg>
  );
}

export function BraceletIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <ellipse cx="12" cy="12" rx="7.5" ry="5.5" />
      <ellipse cx="12" cy="12" rx="7.5" ry="5.5" strokeDasharray="1.2 3.4" />
    </svg>
  );
}

export function AnkletIcon({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...strokeProps}>
      <ellipse cx="10.5" cy="11" rx="7" ry="5" />
      <circle cx="16.8" cy="14.6" r="1.5" />
    </svg>
  );
}
