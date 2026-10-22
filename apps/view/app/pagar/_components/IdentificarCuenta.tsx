"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight } from "lucide-react";
import RutInput from "@/app/components/RutInput";
import { cleanRut, recoverySchema } from "@/app/utils/login-schema";

/**
 * A quién se le paga: por RUT (todos sus contratos), igual que la consulta
 * pública de deuda (CU-39).
 */
export default function IdentificarCuenta() {
  const router = useRouter();
  const [rut, setRut] = useState("");
  const [error, setError] = useState("");

  function continuar(e: React.FormEvent) {
    e.preventDefault();
    const r = recoverySchema.safeParse({ rut });
    if (!r.success) {
      setError(r.error.issues[0]?.message ?? "RUT inválido");
      return;
    }
    router.push(`/pagar?rut=${encodeURIComponent(cleanRut(rut))}`);
  }

  return (
    <form onSubmit={continuar} noValidate className="space-y-5">
      <RutInput
        value={rut}
        error={error}
        onChange={(v) => {
          setRut(v);
          setError("");
        }}
      />

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
