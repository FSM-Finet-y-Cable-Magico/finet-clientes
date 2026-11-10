import Link from 'next/link';
import { CreditCard } from 'lucide-react';

// En celular queda solo el ícono para que quepa junto a "Portal Cliente" y el menú.
export default function PagaTuCuentaButton() {
  return (
    <Link
      href="/consultar-deuda"
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-background hover:opacity-90 transition-opacity focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
    >
      <CreditCard size={16} aria-hidden />
      <span className="sr-only sm:not-sr-only">Paga tu cuenta</span>
    </Link>
  );
}
