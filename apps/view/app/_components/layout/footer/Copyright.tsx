import Link from 'next/link';
import { legalLinks } from './footer.config';
import { hrefMarca, type Marca } from '../../../_lib/company';

export default function Copyright({ marca }: { marca: Marca }) {
  return (
    <div className="border-t border-border bg-surface-deep px-4 py-4">
      <div className="mx-auto max-w-7xl flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted">
          © 2026 {marca.razonSocial} — Todos los derechos reservados
        </p>
        <nav aria-label="Links legales">
          <ul className="flex flex-wrap gap-x-4 gap-y-1">
            {legalLinks.map((link) => {
              const isExternal = link.href.startsWith('http');
              return (
                <li key={link.href}>
                  <Link
                    href={hrefMarca(marca, link.href)}
                    {...(isExternal ? { target: '_blank', rel: 'noopener noreferrer' } : {})}
                    className="text-xs text-muted hover:text-foreground transition-colors"
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      </div>
    </div>
  );
}
