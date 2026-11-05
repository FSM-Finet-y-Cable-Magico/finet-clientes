"use client";

import { useEffect, useRef } from "react";

/**
 * CU-42: Transbank pide llevar al cliente a su formulario mandando el token por
 * POST (`token_ws`). Se envía solo al aparecer; el botón queda por si el
 * navegador no lo hace.
 */
export default function RedireccionWebpay({
  url,
  token,
}: {
  url: string;
  token: string;
}) {
  const formulario = useRef<HTMLFormElement>(null);

  useEffect(() => {
    formulario.current?.submit();
  }, []);

  return (
    <form
      ref={formulario}
      method="post"
      action={url}
      className="p-8 text-center text-sm text-muted"
      aria-live="polite"
    >
      <input type="hidden" name="token_ws" value={token} />
      <p>Te estamos llevando a Webpay…</p>
      <button
        type="submit"
        className="mt-3 font-medium text-primary underline underline-offset-4"
      >
        Ir a Webpay
      </button>
    </form>
  );
}
