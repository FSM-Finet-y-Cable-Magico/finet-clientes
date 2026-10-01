"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import RutInput from "@/app/components/RutInput";
import { cleanRut, recoverySchema } from "@/app/utils/login-schema";

type Modo = "rut" | "abonado";

/**
 * A quién se le paga: por RUT (todos sus contratos) o por código de abonado
 * (ese contrato), igual que la consulta pública de deuda (CU-39 / CU-40).
 */
export default function IdentificarCuenta() {
  const router = useRouter();
  const [modo, setModo] = useState<Modo>("rut");
  const [rut, setRut] = useState("");
  const [codigo, setCodigo] = useState("");
  const [error, setError] = useState("");

  function continuar(e: React.FormEvent) {
    e.preventDefault();
    if (modo === "rut") {
      const r = recoverySchema.safeParse({ rut });
      if (!r.success) {
        setError(r.error.issues[0]?.message ?? "RUT inválido");
        return;
      }
      router.push(`/pagar?rut=${encodeURIComponent(cleanRut(rut))}`);
      return;
    }
    if (!/^\d{1,20}$/.test(codigo)) {
      setError("Ingresa tu código de abonado");
      return;
    }
    router.push(`/pagar?abonado=${encodeURIComponent(codigo)}`);
  }

  function cambiarModo(nuevo: Modo) {
    setModo(nuevo);
    setError("");
  }

  return (
    <form onSubmit={continuar} noValidate className="space-y-5">
      <div
        role="group"
        aria-label="Cómo identificar la cuenta"
        className="flex rounded-xl bg-surface p-1"
      >
        {(
          [
            ["rut", "RUT"],
            ["abonado", "Código de abonado"],
          ] as const
        ).map(([valor, texto]) => (
          <button
            key={valor}
            type="button"
            aria-pressed={modo === valor}
            onClick={() => cambiarModo(valor)}
            className="flex-1 rounded-lg px-3 py-2 text-sm font-medium text-muted transition-colors aria-pressed:bg-background aria-pressed:text-foreground aria-pressed:shadow-sm"
          >
            {texto}
          </button>
        ))}
      </div>

      {modo === "rut" ? (
        <RutInput
          value={rut}
          error={error}
          onChange={(v) => {
            setRut(v);
            setError("");
          }}
        />
      ) : (
        <div>
          <label
            htmlFor="codigoAbonado"
            className="mb-1.5 block text-sm font-medium text-foreground"
          >
            Código de abonado
          </label>
          <input
            id="codigoAbonado"
            type="text"
            inputMode="numeric"
            placeholder="100"
            value={codigo}
            onChange={(e) => {
              setCodigo(e.target.value.replace(/\D/g, ""));
              setError("");
            }}
            aria-invalid={!!error}
            aria-describedby={error ? "codigo-error" : undefined}
            className="w-full rounded-lg border border-border bg-background px-4 py-2.5 text-sm text-foreground outline-none placeholder:text-muted focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary aria-invalid:border-error aria-invalid:bg-error-container"
          />
          {error ? (
            <p id="codigo-error" className="mt-1 text-xs text-error">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <button
        type="submit"
        className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-primary-bright px-5 py-3 text-sm font-semibold text-background transition-all hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary active:scale-[0.99]"
      >
        Ver mi deuda
        <ArrowRight size={16} aria-hidden />
      </button>
    </form>
  );
}
