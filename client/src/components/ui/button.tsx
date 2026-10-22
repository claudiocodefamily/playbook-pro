import { cva, type VariantProps } from 'class-variance-authority';
import type { ButtonHTMLAttributes } from 'react';
import { cn } from '../../lib/cn';
import { Spinner } from './spinner';

const buttonVariants = cva(
  // min-h-11 (44 px): el tamaño mínimo cómodo para tocar con el dedo en una tablet.
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-xl px-4 font-semibold transition-all duration-150 select-none active:scale-[0.97] disabled:pointer-events-none disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-turf-600',
  {
    variants: {
      variant: {
        primary: 'bg-turf-700 text-white shadow-sm hover:bg-turf-800',
        secondary: 'bg-white text-slate-800 ring-1 ring-slate-300 hover:bg-slate-50',
        ghost: 'text-slate-700 hover:bg-slate-200/70',
        danger: 'bg-red-600 text-white hover:bg-red-700',
      },
      size: {
        md: 'text-sm',
        lg: 'min-h-13 px-6 text-base',
        icon: 'size-11 px-0',
      },
    },
    defaultVariants: { variant: 'primary', size: 'md' },
  },
);

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  loading?: boolean;
}

export function Button({
  className,
  variant,
  size,
  loading = false,
  disabled,
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cn(buttonVariants({ variant, size }), className)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {loading && <Spinner className="size-4" />}
      {children}
    </button>
  );
}
