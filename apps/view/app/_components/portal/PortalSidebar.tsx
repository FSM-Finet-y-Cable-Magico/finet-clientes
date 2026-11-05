"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import {
  LayoutDashboard,
  Wifi,
  CreditCard,
  MessageSquare,
  User,
  X,
  LogOut,
  AlertCircle,
} from "lucide-react";
import { useAuth } from "../../_lib/auth";

const navItems = [
  { href: "/portal", label: "Panel", icon: LayoutDashboard },
  { href: "/portal/servicios", label: "Mis Servicios", icon: Wifi },
  { href: "/portal/deuda", label: "Mi Deuda", icon: CreditCard },
  { href: "/portal/tickets", label: "Tickets", icon: MessageSquare },
  { href: "/perfil", label: "Mi Perfil", icon: User },
];

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function PortalSidebar({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [loggingOut, setLoggingOut] = useState(false);
  const [logoutError, setLogoutError] = useState(false);

  function isActive(href: string) {
    if (href === "/perfil") return pathname.startsWith("/perfil");
    if (href === "/portal") return pathname === "/portal";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    setLoggingOut(true);
    setLogoutError(false);
    const ok = await logout();
    if (!ok) {
      setLoggingOut(false);
      setLogoutError(true);
      return;
    }
    router.push("/inicio-sesion");
  }

  const logoutButton = (
    <div className="p-3 border-t border-border">
      {logoutError && (
        <div className="mb-2 rounded-md border border-error bg-error-container px-3 py-2 text-xs text-on-error-container flex items-start gap-1.5">
          <AlertCircle size={14} className="mt-0.5 shrink-0" aria-hidden />
          No fue posible cerrar la sesión. Intenta nuevamente.
        </div>
      )}
      <button
        type="button"
        disabled={loggingOut}
        onClick={handleLogout}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-muted hover:bg-surface hover:text-foreground transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <LogOut size={18} aria-hidden />
        {loggingOut ? "Cerrando sesión..." : logoutError ? "Reintentar" : "Cerrar sesión"}
      </button>
    </div>
  );

  const sidebarContent = (
    <nav aria-label="Navegacion del portal" className="flex flex-col gap-0.5 p-3">
      {navItems.map((item) => {
        const active = isActive(item.href);
        const Icon = item.icon;

        return (
          <Link
            key={item.href}
            href={item.href}
            onClick={onClose}
            aria-current={active ? "page" : undefined}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
              active
                ? "bg-primary/10 text-primary font-medium"
                : "text-muted hover:bg-surface hover:text-foreground"
            }`}
          >
            <Icon size={18} aria-hidden />
            {item.label}
          </Link>
        );
      })}
    </nav>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex lg:flex-col lg:w-60 lg:border-r lg:border-border lg:bg-surface lg:shrink-0 lg:overflow-y-auto">
        <div className="px-3 pt-4 pb-2">
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">
            Portal Cliente
          </p>
        </div>
        <div className="flex-1">{sidebarContent}</div>
        {logoutButton}
      </aside>

      {/* Mobile drawer */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-[60]">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
            aria-hidden
          />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-background border-r border-border shadow-xl z-50 flex flex-col">
            <div className="flex items-center justify-between px-3 pt-4 pb-2">
              <p className="px-3 text-xs font-semibold uppercase tracking-wider text-muted">
                Portal Cliente
              </p>
              <button
                type="button"
                onClick={onClose}
                aria-label="Cerrar menu"
                className="flex items-center justify-center w-8 h-8 rounded-md text-muted hover:bg-surface hover:text-foreground transition-colors"
              >
                <X size={18} />
              </button>
            </div>
            <div className="flex-1">{sidebarContent}</div>
            {logoutButton}
          </aside>
        </div>
      )}
    </>
  );
}
