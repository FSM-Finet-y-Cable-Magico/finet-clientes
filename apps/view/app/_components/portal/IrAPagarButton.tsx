"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard } from "lucide-react";
import { api } from "@/app/utils/api";

/**
 * CU-42 / CU-43 desde el portal: pide el enlace firmado de este cliente y lo
 * lleva a /pagar. Así el RUT no queda en la URL.
 */
export default function IrAPagarButton() {
  const router = useRouter();
  const [abriendo, setAbriendo] = useState(false);
  const [error, setError] = useState("");

  async function ir() {
    setAbriendo(true);
    setError("");
    try {
      const { enlace } = await api.get<{ enlace: string }>("/portal/enlace-pago");
      router.push(enlace);
    } catch (e) {
      setError(
        (e as { message?: string }).message ??
          "No pudimos abrir el pago. Intenta más tarde.",
      );
      setAbriendo(false);
    }
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={() => void ir()}
        disabled={abriendo}
        className="inline-flex items-center gap-2 rounded-lg bg-accent px-5 py-2.5 text-sm font-semibold text-on-accent shadow-sm transition-all hover:shadow-md hover:brightness-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent active:scale-[0.98] disabled:opacity-60"
      >
        <CreditCard size={16} aria-hidden />
        {abriendo ? "Abriendo…" : "Pagar ahora"}
      </button>
      {error ? (
        <p role="alert" className="mt-2 text-xs text-error">
          {error}
        </p>
      ) : null}
    </div>
  );
}
