import type { ReactNode } from "react";
import LoginBranding from "./LoginBranding";

/**
 * El aviso que reemplaza a un formulario de acceso cuando termina o no puede
 * seguir: un ícono, un título y lo que se le dice al cliente, con sus enlaces.
 * Lo usan la recuperación de contraseña (CU-03) y el registro (CU-04).
 */
export default function PanelAviso({
  icono,
  titulo,
  subtitulo,
  children,
}: {
  icono: ReactNode;
  titulo: string;
  /** El de `LoginBranding`; sin él, el del login. */
  subtitulo?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-border bg-background p-8 shadow-sm sm:p-10">
      <LoginBranding subtitle={subtitulo} />
      <div className="mt-6 flex flex-col items-center text-center">
        {icono}
        <h2 className="mt-4 text-lg font-semibold text-foreground">{titulo}</h2>
        {children}
      </div>
    </div>
  );
}
