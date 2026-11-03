interface Props {
  title: string;
  /** Una línea como máximo; el detalle va en "Cómo se calcula". */
  subtitle?: string;
  actions?: React.ReactNode;
  children?: React.ReactNode;
}

/** Encabezado de pantalla del panel: título, subtítulo corto, acciones y controles (p. ej. periodo). */
export default function PageHeader({ title, subtitle, actions, children }: Props) {
  return (
    <header className="mb-6 flex flex-col gap-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <h1 className="text-3xl text-stone-900" style={{ fontFamily: 'var(--font-display)' }}>{title}</h1>
          {subtitle ? <p className="mt-1 text-sm text-stone-600">{subtitle}</p> : null}
        </div>
        {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
      </div>
      {children}
    </header>
  );
}
