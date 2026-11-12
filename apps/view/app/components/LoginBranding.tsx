"use client";

import Image from "next/image";
import { useMarca } from "../_lib/marca";

/** El logo de la empresa del sitio en el login y sus pantallas hermanas. */
export default function LoginBranding({
  subtitle,
}: {
  subtitle?: string;
}) {
  const { logo } = useMarca();
  return (
    <div className="mb-8 text-center">
      <Image
        src={logo.webp}
        alt={logo.alt}
        width={logo.ancho}
        height={logo.alto}
        priority
        className="mx-auto h-10 w-auto"
      />
      <h1 className="mt-4 text-2xl font-bold tracking-tight text-foreground">
        Portal de Clientes
      </h1>
      <p className="mt-1.5 text-sm text-muted">
        {subtitle ?? "Ingresa con tu RUT y contraseña"}
      </p>
    </div>
  );
}
