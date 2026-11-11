"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMarca } from "../../../_lib/marca";
import { hrefMarca, separarMarca } from "../../../_lib/company";

type AudienceSwitchProps = {
  items: { label: string; href: string }[];
};

export default function AudienceSwitch({ items }: AudienceSwitchProps) {
  const marca = useMarca();
  // Sin el prefijo de la empresa: /cable-magico/planes es /planes.
  const { ruta: pathname } = separarMarca(usePathname());
  const isEmpresas = pathname.startsWith("/empresas");

  return (
    <nav aria-label="Tipo de cliente">
      <ul className="flex items-center gap-4">
        {items.map((item, i) => {
          const isActive =
            item.href === "/"
              ? !isEmpresas && (pathname === "/" || !pathname.startsWith("/empresas"))
              : i === 1 && isEmpresas;

          return (
            <li key={item.href}>
              <Link
                href={hrefMarca(marca, item.href)}
                aria-current={isActive ? "page" : undefined}
                className={
                  isActive
                    ? "font-medium text-foreground"
                    : "text-muted hover:text-foreground transition-colors"
                }
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
