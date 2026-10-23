import {
  type InputHTMLAttributes,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
  useId,
} from 'react';
import { cn } from '../../lib/cn';

const controlClass =
  'min-h-11 w-full rounded-xl border border-slate-300 bg-surface px-3 text-base shadow-sm transition-colors placeholder:text-slate-400 focus:border-turf-600 focus:outline-none focus:ring-2 focus:ring-turf-600/30 aria-invalid:border-red-500 dark:focus:border-turf-100';

interface FieldProps {
  label: string;
  hint?: string;
  error?: string;
}

export function TextField({
  label,
  hint,
  error,
  className,
  ...props
}: FieldProps & InputHTMLAttributes<HTMLInputElement>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <input
        id={id}
        className={controlClass}
        aria-invalid={error ? true : undefined}
        aria-describedby={hint || error ? `${id}-help` : undefined}
        {...props}
      />
      {(error ?? hint) && (
        <p id={`${id}-help`} className={cn('text-sm', error ? 'text-red-600' : 'text-slate-500')}>
          {error ?? hint}
        </p>
      )}
    </div>
  );
}

export function SelectField({
  label,
  hint,
  className,
  children,
  ...props
}: FieldProps & SelectHTMLAttributes<HTMLSelectElement>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <select id={id} className={controlClass} {...props}>
        {children}
      </select>
      {hint && <p className="text-sm text-slate-500">{hint}</p>}
    </div>
  );
}

export function TextAreaField({
  label,
  hint,
  className,
  ...props
}: FieldProps & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const id = useId();
  return (
    <div className={cn('flex flex-col gap-1.5', className)}>
      <label htmlFor={id} className="text-sm font-medium text-slate-700">
        {label}
      </label>
      <textarea
        id={id}
        className={cn(controlClass, 'resize-y py-2.5 leading-relaxed')}
        aria-describedby={hint ? `${id}-help` : undefined}
        {...props}
      />
      {hint && (
        <p id={`${id}-help`} className="text-sm text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
}
