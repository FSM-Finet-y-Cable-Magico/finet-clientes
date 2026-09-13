import type { Metadata } from "next";
import { formatPrecioMensual, type PlanBackend } from "./api";
import { COMPANY_BRAND } from "./company";

/**
 * CU-72: etiquetas de indexacion por seccion y plan.
 *
 * Next mezcla la metadata del layout y la de la pagina de forma superficial:
 * si la pagina declara `openGraph`, pierde entero el `openGraph` del layout
 * (siteName, locale, imagen). Y una `opengraph-image` por archivo solo aplica
 * en su propio segmento. Por eso cada seccion arma aqui su metadata completa
 * en vez de heredar pedazos del layout.
 */

/** Excepcion 1 del CU: valores genericos del sitio cuando la seccion o el plan no traen los suyos. */
export const SEO_DEFAULTS = {
  title: "Finet — Internet Fibra Optica y TV Digital | La Pintana, Puente Alto",
  shareTitle: "Finet — Internet Fibra Optica y TV Digital",
  // Sin cifras de planes: el valor por defecto no se regenera con el catalogo.
  description:
    "Internet de fibra optica simetrica de alta velocidad. Planes hogar y empresa en La Pintana, Puente Alto, La Florida y La Granja. Contrata en linea.",
} as const;

/** Sale de `app/opengraph-image.tsx`. */
export const DEFAULT_SHARE_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: SEO_DEFAULTS.shareTitle,
};

/** Lo que el layout raiz deja a las rutas que no pasan por este helper. */
export const BASE_SHARE_METADATA = {
  openGraph: {
    type: "website",
    siteName: COMPANY_BRAND,
    locale: "es_CL",
    images: [DEFAULT_SHARE_IMAGE],
  },
  // Sin titulo ni descripcion: Next los completa desde `openGraph`, que si
  // cambia por pagina.
  twitter: { card: "summary_large_image" },
} satisfies Pick<Metadata, "openGraph" | "twitter">;

type SeccionSeo = {
  /** Ruta de la seccion (`/planes`). Es la URL canonica y la que se comparte. */
  path: string;
  title?: string;
  description?: string | null;
  /** Titulo al compartir; si falta se usa `title` con la marca al final. */
  shareTitle?: string;
  shareDescription?: string;
};

function texto(valor: string | null | undefined): string | undefined {
  return valor?.trim() || undefined;
}

function construir(
  seccion: SeccionSeo,
  { imagenPropia }: { imagenPropia: boolean },
): Metadata {
  const title = texto(seccion.title);
  const description = texto(seccion.description) ?? SEO_DEFAULTS.description;

  const { images, ...openGraphBase } = BASE_SHARE_METADATA.openGraph;

  return {
    title: title ?? { absolute: SEO_DEFAULTS.title },
    description,
    alternates: { canonical: seccion.path },
    openGraph: {
      ...openGraphBase,
      // Si la ruta tiene su propia opengraph-image, la clave `images` no puede
      // existir: con ella presente Next descarta la imagen por archivo.
      ...(imagenPropia ? {} : { images }),
      url: seccion.path,
      title:
        texto(seccion.shareTitle) ??
        (title ? `${title} | ${COMPANY_BRAND}` : SEO_DEFAULTS.shareTitle),
      description: texto(seccion.shareDescription) ?? description,
    },
    twitter: BASE_SHARE_METADATA.twitter,
  };
}

export function metadataSeccion(seccion: SeccionSeo): Metadata {
  return construir(seccion, { imagenPropia: false });
}

/**
 * Cifras "desde" del catalogo, para que las etiquetas de las secciones que
 * listan planes salgan de los datos y no queden desfasadas. `null` si el
 * backend no trae planes: la seccion arma su texto sin cifras.
 */
export function resumenPlanes(planes: PlanBackend[]) {
  if (planes.length === 0) return null;

  const velocidades = planes
    .map((p) => p.velocidad_mbps)
    .filter((v): v is number => v !== null);

  return {
    cantidad: planes.length,
    precioDesde: `${formatPrecioMensual(Math.min(...planes.map((p) => p.precio_mensual)))}/mes`,
    mbpsDesde: velocidades.length > 0 ? Math.min(...velocidades) : null,
  };
}

/**
 * Metadata de `/contratar/[planId]`. La imagen la genera la
 * `opengraph-image` de esa ruta con los datos del plan.
 */
export function metadataPlan(plan: PlanBackend | null, path: string): Metadata {
  if (!plan) return construir({ path }, { imagenPropia: true });

  const precio = `${formatPrecioMensual(plan.precio_mensual)}/mes`;
  const descripcion = texto(plan.descripcion);

  return construir(
    {
      path,
      title: `Contratar ${plan.nombre_comercial}`,
      description: descripcion
        ? `${plan.nombre_comercial}: ${descripcion} por ${precio}. Internet fibra optica en La Pintana y Puente Alto.`
        : undefined,
      shareTitle: `${plan.nombre_comercial} por ${precio} | ${COMPANY_BRAND}`,
    },
    { imagenPropia: true },
  );
}
