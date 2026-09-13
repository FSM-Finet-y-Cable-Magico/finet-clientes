"use client";

import { useRef, useState, type FormEvent } from "react";
import PrimaryButton from "../ui/PrimaryButton";
import CasillaPoliticaPrivacidad from "../legal/CasillaPoliticaPrivacidad";
import type { PlanBackend } from "../../_lib/api";
import {
  MENSAJE_POLITICA_REQUERIDA,
  POLITICA_PRIVACIDAD_VERSION,
} from "../../_lib/legal";

type FormularioContratacionProps = {
  plan: PlanBackend;
};

type FormState = "idle" | "loading" | "success" | "error";

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "";

/** El backend responde `{ message, errors?: [{ message }] }`. */
async function mensajeDeError(res: Response): Promise<string> {
  const cuerpo = (await res.json().catch(() => null)) as {
    message?: string;
    errors?: { message?: string }[];
  } | null;
  return (
    cuerpo?.errors?.[0]?.message ??
    cuerpo?.message ??
    `Error del servidor (${res.status})`
  );
}

export default function FormularioContratacion({ plan }: FormularioContratacionProps) {
  const [status, setStatus] = useState<FormState>("idle");
  const [errorMessage, setErrorMessage] = useState("");
  const [aceptaPolitica, setAceptaPolitica] = useState(false);
  const [errorPolitica, setErrorPolitica] = useState("");
  const casillaRef = useRef<HTMLInputElement>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    // CU-75, Excepción 1: sin la casilla no se envía nada.
    if (!aceptaPolitica) {
      setErrorPolitica(MENSAJE_POLITICA_REQUERIDA);
      casillaRef.current?.focus();
      return;
    }

    setStatus("loading");
    setErrorMessage("");

    const data = new FormData(e.currentTarget);
    const campo = (nombre: string) => String(data.get(nombre) ?? "").trim();
    // Los nombres del DTO del backend (ContratacionDto), no los del formulario.
    const payload = {
      id_plan: plan.id_plan,
      nombre_completo: campo("nombreCompleto"),
      rut: campo("rut"),
      email: campo("correoElectronico"),
      telefono: campo("telefonoMovil") || null,
      direccion_completa: campo("calleNumero"),
      comuna: campo("comuna"),
      acepta_politica_privacidad: true,
      version_politica_privacidad: POLITICA_PRIVACIDAD_VERSION,
    };

    try {
      const res = await fetch(`${API_URL}/contrataciones`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        throw new Error(await mensajeDeError(res));
      }

      setStatus("success");
    } catch (err) {
      setStatus("error");
      setErrorMessage(
        err instanceof Error
          ? err.message
          : "No se pudo enviar la solicitud. Intenta nuevamente."
      );
    }
  };

  if (status === "success") {
    return (
      <div className="grid max-w-xl gap-4 border border-success bg-success-container p-6 rounded-lg" role="alert">
        <h2 className="text-lg font-medium text-on-success-container">
          Solicitud enviada
        </h2>
        <p className="text-sm text-on-success-container">
          Tu solicitud para <strong>{plan.nombre_comercial}</strong> ha sido recibida
          y quedó registrada tu aceptación de la Política de Privacidad. Te
          contactaremos pronto al telefono y correo proporcionados.
        </p>
        <a
          href="/planes"
          className="text-sm text-primary hover:underline"
        >
          &larr; Volver a planes
        </a>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid max-w-xl gap-4 border border-border p-6 rounded-lg"
    >
      <label className="grid gap-1" htmlFor="nombreCompleto">
        Nombre completo
        <input
          id="nombreCompleto"
          name="nombreCompleto"
          required
          placeholder="Nombre1 Nombre2 Ap1 Ap2"
          pattern="[A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ]+){1,3}"
          title="Nombre1 Nombre2 Ap1 Ap2. Respetar tildes. Max 4 palabras visibles."
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <label className="grid gap-1" htmlFor="rut">
        RUT
        <input
          id="rut"
          name="rut"
          required
          placeholder="XX.XXX.XXX-X"
          pattern="[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]"
          title="XX.XXX.XXX-X"
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <label className="grid gap-1" htmlFor="correoElectronico">
        Correo electronico
        <input
          id="correoElectronico"
          name="correoElectronico"
          type="email"
          required
          placeholder="usuario@dominio.cl"
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"
          title="usuario@dominio.cl, siempre en minusculas"
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <label className="grid gap-1" htmlFor="telefonoMovil">
        Telefono movil
        <input
          id="telefonoMovil"
          name="telefonoMovil"
          type="tel"
          required
          placeholder="+56 9 XXXX XXXX"
          pattern="\+56 9 [0-9]{4} [0-9]{4}"
          title="+56 9 XXXX XXXX"
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <fieldset className="grid gap-4 border border-border p-4 rounded-md">
        <legend className="px-1 text-sm">Direccion de instalacion</legend>

        <label className="grid gap-1" htmlFor="calleNumero">
          Calle + numero
          <input
            id="calleNumero"
            name="calleNumero"
            required
            placeholder="Nombre Calle N°XXX"
            className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          />
        </label>

        <label className="grid gap-1" htmlFor="comuna">
          Comuna
          <input
            id="comuna"
            name="comuna"
            required
            placeholder="Nombre oficial"
            title="Title Case. Usar catalogo oficial de comunas."
            className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          />
        </label>
      </fieldset>

      <CasillaPoliticaPrivacidad
        ref={casillaRef}
        checked={aceptaPolitica}
        error={errorPolitica}
        onChange={(marcada) => {
          setAceptaPolitica(marcada);
          if (marcada) setErrorPolitica("");
        }}
      />

      {status === "error" && (
        <p className="text-sm text-error" role="alert">
          {errorMessage}
        </p>
      )}

      <PrimaryButton
        type="submit"
        variant="conversion"
        disabled={status === "loading"}
        className="w-full"
      >
        {status === "loading" ? "Enviando..." : "Enviar solicitud"}
      </PrimaryButton>
    </form>
  );
}
