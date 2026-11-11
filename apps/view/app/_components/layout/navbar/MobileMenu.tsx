"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X, ChevronDown } from "lucide-react";
import { useState } from "react";
import type { NavItem } from "./nav.config";
import { useMarca } from "../../../_lib/marca";
import { hrefMarca, separarMarca } from "../../../_lib/company";

type MobileMenuProps = {
  items: NavItem[];
};

export default function MobileMenu({ items }: MobileMenuProps) {
  const marca = useMarca();
  // Sin el prefijo de la empresa: /cable-magico/planes es /planes.
  const { ruta: pathname } = separarMarca(usePathname());
  const [isOpen, setIsOpen] = useState(false);
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (href: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(href)) {
        next.delete(href);
      } else {
        next.add(href);
      }
      return next;
    });
  };

  const closeMobileMenu = () => setIsOpen(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-controls="menu-movil"
        aria-expanded={isOpen}
        aria-label={isOpen ? "Cerrar menu movil" : "Abrir menu movil"}
        className="flex h-9 w-9 items-center justify-center rounded-md text-muted hover:bg-surface hover:text-foreground"
        onClick={() => setIsOpen((v) => !v)}
      >
        {isOpen ? <X size={18} /> : <Menu size={18} />}
      </button>
      <nav
        id="menu-movil"
        aria-label="Navegacion principal movil"
        hidden={!isOpen}
        className="absolute left-0 right-0 top-full border-b border-border bg-background px-4 py-3 max-h-[80vh] overflow-y-auto"
      >
        <ul className="grid gap-1">
          {items.map((item) => {
            const hasChildren = Boolean(item.children?.length);
            const isActive =
              pathname === item.href || pathname.startsWith(item.href + "/");
            const isExpanded = expandedGroups.has(item.href);

            return (
              <li key={item.href}>
                {hasChildren ? (
                  <>
                    <button
                      type="button"
                      aria-expanded={isExpanded}
                      onClick={() => toggleGroup(item.href)}
                      className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-sm transition-colors ${
                        isActive
                          ? "text-primary"
                          : "text-foreground hover:bg-surface"
                      }`}
                    >
                      {item.label}
                      <ChevronDown
                        size={14}
                        className={`text-muted transition-transform ${
                          isExpanded ? "rotate-180" : ""
                        }`}
                        aria-hidden
                      />
                    </button>
                    {isExpanded && (
                      <ul className="ml-4 mt-1 border-l border-border pl-3 grid gap-1">
                        {item.children!.map((child) => (
                          <li key={child.href}>
                            <Link
                              href={hrefMarca(marca, child.href)}
                              onClick={closeMobileMenu}
                              aria-current={
                                pathname === child.href ? "page" : undefined
                              }
                              className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                                pathname === child.href
                                  ? "text-primary bg-surface"
                                  : "text-foreground hover:bg-surface"
                              }`}
                            >
                              {child.label}
                            </Link>
                          </li>
                        ))}
                      </ul>
                    )}
                  </>
                ) : (
                  <Link
                    href={hrefMarca(marca, item.href)}
                    onClick={closeMobileMenu}
                    aria-current={isActive ? "page" : undefined}
                    className={`block rounded-md px-3 py-2 text-sm transition-colors ${
                      isActive
                        ? "text-primary bg-surface"
                        : "text-foreground hover:bg-surface"
                    }`}
                  >
                    {item.label}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}
