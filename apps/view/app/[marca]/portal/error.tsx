'use client';

import { AlertTriangle } from 'lucide-react';

export default function PortalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 sm:px-6 lg:px-8 flex flex-col items-center gap-4 text-center">
      <AlertTriangle className="text-warning" size={40} strokeWidth={1.5} />
      <h2 className="text-lg font-semibold text-foreground">No pudimos cargar tu portal</h2>
      <p className="text-sm text-muted max-w-sm">{error.message}</p>
      <button
        onClick={reset}
        className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-white hover:opacity-90 transition-opacity"
      >
        Reintentar
      </button>
    </div>
  );
}
