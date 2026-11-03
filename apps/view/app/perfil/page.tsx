"use client";

import { useEffect, useState, useCallback } from "react";
import { User, AlertCircle, RefreshCw } from "lucide-react";
import ChangePasswordForm from "../components/ChangePasswordForm";
import UpdateTelefonoForm from "../components/UpdateTelefonoForm";
import UpdateEmailForm from "../components/UpdateEmailForm";
import { api } from "../utils/api";
import { fechaInstante } from "@/app/_lib/formato";

type ClientePerfil = {
  id_cliente: number;
  nombre_completo: string;
  rut: string;
  email: string;
  telefono: string;
  fecha_creacion: string;
};

export default function PerfilPage() {
  const [perfil, setPerfil] = useState<ClientePerfil | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchPerfil = useCallback(async () => {
    setLoading(true);
    setError(false);

    try {
      const data = await api.get<ClientePerfil>("/auth/perfil");
      setPerfil(data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const t = setTimeout(() => fetchPerfil(), 0);
    return () => clearTimeout(t);
  }, [fetchPerfil]);

  function formatRut(rut: string) {
    const body = rut.slice(0, -1);
    const dv = rut.slice(-1);
    const dotted = body.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
    return `${dotted}-${dv}`;
  }

  return (
    <div className="max-w-2xl">
      <div className="flex items-center gap-3 mb-8">
        <div className="inline-flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 text-primary">
          <User size={20} aria-hidden />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            Mis Datos Personales
          </h1>
          <p className="text-sm text-muted">
            Información de tu cuenta
          </p>
        </div>
      </div>

      {loading && (
        <div className="border border-border rounded-xl p-6 bg-background">
          <div className="animate-pulse space-y-4">
            <div className="h-4 w-32 rounded bg-border" />
            <div className="h-4 w-48 rounded bg-border" />
            <div className="h-4 w-40 rounded bg-border" />
            <div className="h-4 w-36 rounded bg-border" />
          </div>
        </div>
      )}

      {error && (
        <div className="border border-error bg-error-container rounded-xl p-6">
          <div className="flex items-start gap-3">
            <AlertCircle size={20} className="text-error mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="text-sm font-medium text-error">
                No se pudo cargar la información
              </p>
              <p className="mt-1 text-sm text-error">
                Ocurrió un error al consultar tus datos. Intenta nuevamente.
              </p>
              <button
                type="button"
                onClick={fetchPerfil}
                className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-error hover:opacity-80 transition-colors"
              >
                <RefreshCw size={14} aria-hidden />
                Reintentar
              </button>
            </div>
          </div>
        </div>
      )}

      {perfil && (
        <div className="border border-border rounded-xl bg-background divide-y divide-border">
          <div className="flex items-center gap-3 p-5">
            <span className="text-sm text-muted w-28 shrink-0">
              Nombre
            </span>
            <span className="text-sm font-medium text-foreground">
              {perfil.nombre_completo}
            </span>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="text-sm text-muted w-28 shrink-0">
              RUT
            </span>
            <span className="text-sm font-medium text-foreground">
              {formatRut(perfil.rut)}
            </span>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="text-sm text-muted w-28 shrink-0">
              Email
            </span>
            <span className="text-sm font-medium text-foreground">
              {perfil.email}
            </span>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="text-sm text-muted w-28 shrink-0">
              Teléfono
            </span>
            <span className="text-sm font-medium text-foreground">
              {perfil.telefono || "—"}
            </span>
          </div>
          <div className="flex items-center gap-3 p-5">
            <span className="text-sm text-muted w-28 shrink-0">
              Cliente desde
            </span>
            <span className="text-sm font-medium text-foreground">
              {fechaInstante(perfil.fecha_creacion, "larga")}
            </span>
          </div>
        </div>
      )}

      {perfil && (
        <>
          <div className="mt-8 space-y-6">
            <UpdateTelefonoForm
              onUpdate={(nuevoTelefono) =>
                setPerfil((prev) =>
                  prev ? { ...prev, telefono: nuevoTelefono } : prev,
                )
              }
            />
            <UpdateEmailForm
              currentEmail={perfil.email}
              onUpdate={(nuevoEmail) =>
                setPerfil((prev) =>
                  prev ? { ...prev, email: nuevoEmail } : prev,
                )
              }
            />
          </div>
          <div className="mt-8">
            <ChangePasswordForm />
          </div>
        </>
      )}
    </div>
  );
}
