import { LoaderCircle } from 'lucide-react';
import { cn } from '../../lib/cn';

export function Spinner({ className }: { className?: string }) {
  return <LoaderCircle aria-hidden className={cn('size-6 animate-spin', className)} />;
}

/** Ocupa la zona de contenido mientras carga una página. */
export function PageSpinner({ label = 'Cargando…' }: { label?: string }) {
  return (
    <div
      role="status"
      className="flex flex-1 items-center justify-center gap-3 py-24 text-slate-500"
    >
      <Spinner />
      <span>{label}</span>
    </div>
  );
}
