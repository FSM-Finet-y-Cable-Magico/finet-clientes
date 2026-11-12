import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import type { Marca } from "./company";

export const OG_SIZE = { width: 1200, height: 630 };

/** Texto alternativo de la tarjeta: el mismo para las dos empresas. */
export const OG_ALT = "Internet fibra optica y TV digital";

/** Excepcion 1 del CU-72: la tarjeta de cada empresa cuando no hay datos propios. */
export function ogCardGenerica(marca: Marca) {
  return { titulo: OG_ALT, bajada: marca.comunas.join(" · ") };
}

/** Los colores de la tarjeta de cada empresa (Finet: DESIGN.md; Cable Mágico: su rojo). */
const COLORES = {
  finet: {
    fondo: "linear-gradient(135deg, #0b1c30 0%, #003d48 100%)",
    destacado: "#e6e748",
    bajada: "#62d5f1",
    logo: { width: 163, height: 107 },
  },
  "cable-magico": {
    fondo: "linear-gradient(135deg, #2b0000 0%, #8e0e14 100%)",
    destacado: "#ffffff",
    bajada: "#ffb3b3",
    logo: { width: 120, height: 120 },
  },
} as const;

type OgCardProps = {
  titulo: string;
  bajada: string;
  /** Linea destacada bajo el titulo, p. ej. el precio del plan. */
  destacado?: string;
};

/** Tarjeta de las `opengraph-image` (CU-72), con el logo y los colores de la empresa. */
export async function ogCard(
  { titulo, bajada, destacado }: OgCardProps,
  marca: Marca,
) {
  const colores = COLORES[marca.slug as keyof typeof COLORES] ?? COLORES.finet;
  const logo = await readFile(join(process.cwd(), "public", marca.logo.png));
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
          background: colores.fondo,
          color: "#eaf1ff",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element -- ImageResponse no admite next/image */}
        <img src={logoSrc} alt="" width={colores.logo.width} height={colores.logo.height} />
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ fontSize: 68, fontWeight: 700, lineHeight: 1.1 }}>
            {titulo}
          </div>
          {destacado ? (
            <div style={{ fontSize: 48, marginTop: 20, color: colores.destacado }}>
              {destacado}
            </div>
          ) : null}
          <div style={{ fontSize: 32, marginTop: 24, color: colores.bajada }}>
            {bajada}
          </div>
        </div>
      </div>
    ),
    OG_SIZE,
  );
}
