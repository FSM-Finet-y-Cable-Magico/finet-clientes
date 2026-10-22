import type { Metadata } from "next";
import { metadataSeccion } from "../_lib/seo";
import PortalDePagos, { type Identificador } from "./_components/PortalDePagos";

export const metadata: Metadata = metadataSeccion({
  path: "/pagar",
  title: "Pagar mi cuenta",
  description:
    "Paga la deuda de tu servicio Finet con Webpay o Mercado Pago, con tu RUT.",
});

type Props = {
  searchParams: Promise<{ rut?: string; t?: string }>;
};

/**
 * CU-42 / CU-43: portal de pagos. Se llega por el enlace del aviso de corte
 * (`?t=`), por el botón "Pagar ahora" del portal (también `?t=`), por la
 * consulta pública (`?rut=`), o directo, a identificar la cuenta.
 */
export default async function PagarPage({ searchParams }: Props) {
  const { rut, t } = await searchParams;
  const identificador: Identificador | null = t ? { t } : rut ? { rut } : null;

  return (
    <main className="min-h-[calc(100vh-200px)] bg-surface px-4 py-10">
      <PortalDePagos identificador={identificador} />
    </main>
  );
}
