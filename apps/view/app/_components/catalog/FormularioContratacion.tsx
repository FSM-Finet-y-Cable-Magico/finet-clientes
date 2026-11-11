"use client";

import { useRef, useState, type FormEvent } from "react";
import PrimaryButton from "../ui/PrimaryButton";
import CasillaPoliticaPrivacidad from "../legal/CasillaPoliticaPrivacidad";
import type { PlanBackend } from "../../_lib/api";
import { API_URL } from "../../_lib/consts";
import {
  MENSAJE_POLITICA_REQUERIDA,
  POLITICA_PRIVACIDAD_VERSION,
} from "../../_lib/legal";
import { cleanTelefono, formatRut, formatTelefono } from "../../utils/login-schema";

type FormularioContratacionProps = {
  plan: PlanBackend;
};

type FormState = "idle" | "loading" | "success" | "error";

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
  const [rut, setRut] = useState("");
  const [correo, setCorreo] = useState("");
  const [telefono, setTelefono] = useState("");
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
      // Sin espacios y con el +56, igual que el teléfono del perfil.
      telefono: `+56${cleanTelefono(campo("telefonoMovil"))}`,
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
          maxLength={120}
          autoComplete="name"
          placeholder="Nombre y apellidos"
          pattern="[A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-]+(?: [A-Za-zÁÉÍÓÚÜÑáéíóúüñ'\-]+)+"
          title="Tu nombre y al menos un apellido, con tildes si las llevan. Ej: María José de la Fuente"
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <label className="grid gap-1" htmlFor="rut">
        RUT
        <input
          id="rut"
          name="rut"
          required
          maxLength={12}
          placeholder="12.345.678-9"
          pattern="[0-9]{1,2}\.[0-9]{3}\.[0-9]{3}-[0-9K]"
          title="RUT con dígito verificador, por ejemplo 12.345.678-9"
          value={rut}
          onChange={(e) => setRut(formatRut(e.target.value))}
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
          autoComplete="email"
          placeholder="usuario@dominio.cl"
          pattern="[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}"
          title="usuario@dominio.cl"
          value={correo}
          onChange={(e) => setCorreo(e.target.value.toLowerCase().replace(/\s/g, ""))}
          className="border border-border bg-background p-2 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
        />
      </label>

      <div className="grid gap-1">
        <label htmlFor="telefonoMovil">Telefono movil</label>
        <div className="flex">
          <span
            aria-hidden
            className="flex items-center rounded-l-md border border-r-0 border-border bg-surface px-3 text-muted"
          >
            +56
          </span>
          <input
            id="telefonoMovil"
            name="telefonoMovil"
            type="tel"
            inputMode="numeric"
            autoComplete="tel"
            required
            placeholder="9 1234 5678"
            pattern="9 [0-9]{4} [0-9]{4}"
            title="Celular de 9 dígitos que empieza con 9, por ejemplo 9 1234 5678"
            value={telefono}
            onChange={(e) => setTelefono(formatTelefono(e.target.value))}
            className="min-w-0 flex-1 border border-border bg-background p-2 rounded-r-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-0 focus-visible:outline-primary"
          />
        </div>
      </div>

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
