"use client";

import PrimaryButton from "../ui/PrimaryButton";
import { useMarca } from "../../_lib/marca";
import { rutaMarca } from "../../_lib/company";

/** El contenido de la página 404, con el inicio del sitio de su empresa. */
export default function NoEncontrado() {
  const marca = useMarca();
  return (
    <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
      <p className="text-8xl font-extrabold text-primary/20 select-none">
        404
      </p>
      <div className="-mt-10">
        <h1 className="text-2xl font-bold text-foreground">
          Pagina no encontrada
        </h1>
        <p className="text-muted mt-2 max-w-md mx-auto">
          La pagina que buscas no existe o fue movida. Revisa la URL o vuelve
          al inicio.
        </p>
      </div>
      <div className="mt-8">
        <PrimaryButton href={rutaMarca(marca, "/")} variant="solid">
          Volver al inicio
        </PrimaryButton>
      </div>
    </section>
  );
}
