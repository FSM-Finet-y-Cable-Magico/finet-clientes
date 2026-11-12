"use client";

import Link from 'next/link';
import { CreditCard } from 'lucide-react';
import { useMarca } from '../../../_lib/marca';
import { rutaMarca } from '../../../_lib/company';

// En celular queda solo el ícono, cuadrado. Bajo 360 px no cabe junto al logo,
// "Portal Cliente" y el menú, así que se oculta: el footer también lo tiene.
export default function PagaTuCuentaButton() {
  const marca = useMarca();
  return (
    <Link
      href={rutaMarca(marca, '/consultar-deuda')}
      className="max-[359px]:hidden inline-flex h-9 items-center gap-1.5 rounded-lg bg-primary px-2.5 sm:px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <CreditCard size={16} aria-hidden />
      <span className="sr-only sm:not-sr-only">Paga tu cuenta</span>
    </Link>
  );
}
