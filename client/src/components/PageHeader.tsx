import { ChevronLeft } from 'lucide-react';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

interface PageHeaderProps {
  title: string;
  subtitle?: ReactNode;
  back?: { to: string; label: string };
  actions?: ReactNode;
}

export function PageHeader({ title, subtitle, back, actions }: PageHeaderProps) {
  return (
    <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        {back && (
          <Link
            to={back.to}
            className="mb-1 inline-flex min-h-8 items-center gap-1 text-sm font-medium text-turf-700 dark:text-turf-300 hover:underline"
          >
            <ChevronLeft aria-hidden className="size-4" />
            {back.label}
          </Link>
        )}
        <h1 className="truncate text-3xl font-bold">{title}</h1>
        {subtitle && <div className="mt-1 text-slate-600">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>}
    </div>
  );
}
