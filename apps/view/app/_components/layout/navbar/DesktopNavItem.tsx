"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { ChevronDown } from "lucide-react";
import type { NavItem } from "./nav.config";
import { useMarca } from "../../../_lib/marca";
import { hrefMarca, separarMarca } from "../../../_lib/company";

type DesktopNavItemProps = {
  item: NavItem;
};

export default function DesktopNavItem({ item }: DesktopNavItemProps) {
  const marca = useMarca();
  // Sin el prefijo de la empresa: /cable-magico/planes es /planes.
  const { ruta: pathname } = separarMarca(usePathname());
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLLIElement>(null);
  const hasChildren = Boolean(item.children?.length);
  const isActive = pathname === item.href || pathname.startsWith(item.href + "/");

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  useEffect(() => {
    function handleEscape(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen]);

  return (
    <li ref={dropdownRef} className="relative">
      {hasChildren ? (
        <>
          <button
            type="button"
            aria-expanded={isOpen}
            aria-haspopup="true"
            onClick={() => setIsOpen(!isOpen)}
            className={`inline-flex items-center gap-0.5 text-sm transition-colors ${
              isActive
                ? "text-primary"
                : "text-foreground hover:text-primary"
            }`}
          >
            {item.label}
            <ChevronDown
              size={14}
              className={`text-muted transition-transform ${isOpen ? "rotate-180" : ""}`}
              aria-hidden
            />
          </button>
          {isOpen && (
            <ul
              className="absolute left-0 top-full mt-1 min-w-[180px] rounded-lg border border-border bg-background p-1 shadow-lg z-50"
              role="menu"
            >
              {item.children!.map((child) => (
                <li key={child.href} role="none">
                  <Link
                    href={hrefMarca(marca, child.href)}
                    role="menuitem"
                    onClick={() => setIsOpen(false)}
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
          aria-current={isActive ? "page" : undefined}
          className={`text-sm transition-colors ${
            isActive
              ? "text-primary"
              : "text-foreground hover:text-primary"
          }`}
        >
          {item.label}
        </Link>
      )}
    </li>
  );
}
