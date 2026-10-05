import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";

export const OG_SIZE = { width: 1200, height: 630 };

/** Excepcion 1 del CU-72: la tarjeta cuando no hay datos propios. */
export const OG_CARD_GENERICA = {
  titulo: "Internet fibra optica y TV digital",
  bajada: "La Pintana · Puente Alto · La Florida · La Granja",
};

type OgCardProps = {
  titulo: string;
  bajada: string;
  /** Linea destacada bajo el titulo, p. ej. el precio del plan. */
  destacado?: string;
};

/** Tarjeta de las `opengraph-image` (CU-72), con la paleta de DESIGN.md. */
export async function ogCard({ titulo, bajada, destacado }: OgCardProps) {
  const logo = await readFile(join(process.cwd(), "public/brand/FinetLogo.png"));
  const logoSrc = `data:image/png;base64,${logo.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0b1c30 0%, #003d48 100%)",
          color: "#eaf1ff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no admite next/image */}
        <img src={logoSrc} alt="" width={163} height={107} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {titulo}
          </div>
          {destacado ? (
            <div style={{ fontSize: 48, marginTop: 20, color: "#e6e748" }}>
              {destacado}
            </div>
          ) : null}
          <div style={{ fontSize: 32, marginTop: 24, color: "#62d5f1" }}>
            {bajada}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
