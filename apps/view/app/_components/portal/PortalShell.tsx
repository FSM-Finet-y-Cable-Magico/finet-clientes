"use client";

import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import PortalSidebar from "./PortalSidebar";
import { useMarca } from "../../_lib/marca";

export default function PortalShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const marca = useMarca();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [headerHeight, setHeaderHeight] = useState(0);

  useEffect(() => {
    const header = document.querySelector("header");
    if (!header) return;

    function measure() {
      setHeaderHeight(header!.getBoundingClientRect().height);
    }

    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(header);
    window.addEventListener("resize", measure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", measure);
    };
  }, []);

  return (
    <div
      className="flex overflow-hidden"
      style={{ height: `calc(100svh - ${headerHeight}px)` }}
    >
      <PortalSidebar
        open={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <main className="flex-1 min-w-0 overflow-y-auto">
        <div className="lg:hidden flex items-center gap-3 px-4 py-3 border-b border-border bg-background">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            aria-label="Abrir menu del portal"
            className="flex items-center justify-center w-8 h-8 rounded-md text-muted hover:bg-surface hover:text-foreground transition-colors"
          >
            <Menu size={18} />
          </button>
          <span className="text-sm font-medium text-foreground">
            Portal Cliente {marca.nombre}
          </span>
        </div>
        <div className="p-4 lg:p-8">{children}</div>
      </main>
    </div>
  );
}
