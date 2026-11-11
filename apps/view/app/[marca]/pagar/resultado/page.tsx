import type { Metadata } from "next";
import { metadataSeccion } from "../../../_lib/seo";
import ResultadoPago from "../_components/ResultadoPago";

export const metadata: Metadata = metadataSeccion({
  path: "/pagar/resultado",
  title: "Resultado del pago",
  description: "El resultado de tu pago con Webpay.",
});

type Props = {
  searchParams: Promise<{ resultado?: string; token_ws?: string }>;
};

/**
 * CU-42: adonde vuelve el cliente desde Webpay. El backend recibe a Webpay, sigue
 * con el registro y lo redirige acá con el resultado y el token.
 */
export default async function ResultadoPagoPage({ searchParams }: Props) {
  const { resultado, token_ws } = await searchParams;

  return (
    <main className="min-h-[calc(100vh-200px)] bg-surface px-4 py-10">
      <ResultadoPago resultado={resultado ?? null} token={token_ws ?? null} />
    </main>
  );
}
