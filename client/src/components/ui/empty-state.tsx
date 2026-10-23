import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-3xl border-2 border-dashed border-slate-300 px-6 py-14 text-center">
      <div className="rounded-2xl bg-turf-100 p-4 text-turf-700 dark:bg-turf-900/60 dark:text-turf-100">
        <Icon aria-hidden className="size-8" />
      </div>
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="max-w-sm text-slate-600">{description}</p>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
