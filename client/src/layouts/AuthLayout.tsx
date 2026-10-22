import { motion } from 'motion/react';
import type { ReactNode } from 'react';

/** Fondo de cancha con la tarjeta de login o registro en el centro. */
export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: ReactNode;
}) {
  return (
    <main className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-turf-800 p-4">
      {/* Líneas de yarda decorativas. */}
      <div
        aria-hidden
        className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'repeating-linear-gradient(0deg, transparent 0 78px, white 78px 80px)',
        }}
      />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 26 }}
        className="relative w-full max-w-md rounded-3xl bg-white p-8 shadow-2xl"
      >
        <p className="text-sm font-bold tracking-widest text-turf-700 uppercase">PlayBook Pro</p>
        <h1 className="mt-2 text-3xl font-bold">{title}</h1>
        <p className="mt-1 text-slate-600">{subtitle}</p>
        <div className="mt-6">{children}</div>
      </motion.div>
    </main>
  );
}
