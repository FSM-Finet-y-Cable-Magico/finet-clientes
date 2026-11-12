import type { Metadata } from "next";
import { formatPrecio } from "./formato";
import type { PlanBackend } from "./api";
import { MARCA_POR_DEFECTO, rutaMarca, type Marca } from "./company";
import { esIndexable } from "./rutas-publicas";

/**
 * CU-72: etiquetas de indexacion por seccion y plan.
 *
 * Next mezcla la metadata del layout y la de la pagina de forma superficial:
 * si la pagina declara `openGraph`, pierde entero el `openGraph` del layout
 * (siteName, locale, imagen). Y una `opengraph-image` por archivo solo aplica
 * en su propio segmento. Por eso cada seccion arma aqui su metadata completa
 * en vez de heredar pedazos del layout.
 */

/**
 * Excepcion 1 del CU: valores genericos del sitio de cada empresa cuando la
 * seccion o el plan no traen los suyos. Sin cifras de planes: el valor por
 * defecto no se regenera con el catalogo.
 */
export function seoDe(marca: Marca) {
  return {
    title: `${marca.nombre} — Internet Fibra Optica y TV Digital | ${marca.comunas.slice(0, 2).join(", ")}`,
    shareTitle: `${marca.nombre} — Internet Fibra Optica y TV Digital`,
    description: `Internet de fibra optica simetrica de alta velocidad. Planes hogar y empresa en ${marca.zonaTexto}. Contrata en linea.`,
  };
}

/** La imagen para compartir del sitio de cada empresa (`[marca]/opengraph-image`). */
export function imagenCompartir(marca: Marca) {
  return {
    url: rutaMarca(marca, "/opengraph-image"),
    width: 1200,
    height: 630,
    alt: seoDe(marca).shareTitle,
  };
}

/** Lo que el layout de cada empresa deja a las rutas que no pasan por este helper. */
export function metadataCompartir(marca: Marca) {
  return {
    openGraph: {
      type: "website",
      siteName: marca.nombre,
      locale: "es_CL",
      images: [imagenCompartir(marca)],
    },
    // Sin titulo ni descripcion: Next los completa desde `openGraph`, que si
    // cambia por pagina.
    twitter: { card: "summary_large_image" },
  } satisfies Pick<Metadata, "openGraph" | "twitter">;
}

/** Los de Finet, la marca por defecto. */
export const SEO_DEFAULTS = seoDe(MARCA_POR_DEFECTO);
export const DEFAULT_SHARE_IMAGE = imagenCompartir(MARCA_POR_DEFECTO);

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
  marca: Marca,
): Metadata {
  const seo = seoDe(marca);
  const title = texto(seccion.title);
  const description = texto(seccion.description) ?? seo.description;
  // La URL de la seccion en el sitio de su empresa.
  const url = rutaMarca(marca, seccion.path as `/${string}`);

  const { images, ...openGraphBase } = metadataCompartir(marca).openGraph;

  return {
    title: title ?? { absolute: seo.title },
    description,
    // CU-74: el registro de rutas decide. Una pagina con noindex no declara
    // canonical, que le pediria al buscador indexar esa URL.
    ...(esIndexable(seccion.path)
      ? { alternates: { canonical: url } }
      : { robots: { index: false, follow: true } }),
    openGraph: {
      ...openGraphBase,
      // Si la ruta tiene su propia opengraph-image, la clave `images` no puede
      // existir: con ella presente Next descarta la imagen por archivo.
      ...(imagenPropia ? {} : { images }),
      url,
      title:
        texto(seccion.shareTitle) ??
        (title ? `${title} | ${marca.nombre}` : seo.shareTitle),
      description: texto(seccion.shareDescription) ?? description,
    },
    twitter: metadataCompartir(marca).twitter,
  };
}

/** Metadata de una seccion del sitio de una empresa (Finet si no se dice). */
export function metadataSeccion(
  seccion: SeccionSeo,
  marca: Marca = MARCA_POR_DEFECTO,
): Metadata {
  return construir(seccion, { imagenPropia: false }, marca);
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
    precioDesde: `${formatPrecio(Math.min(...planes.map((p) => p.precio_mensual)))}/mes`,
    mbpsDesde: velocidades.length > 0 ? Math.min(...velocidades) : null,
  };
}

/**
 * Metadata de `/contratar/[planId]`. La imagen la genera la
 * `opengraph-image` de esa ruta con los datos del plan.
 */
export function metadataPlan(
  plan: PlanBackend | null,
  path: string,
  marca: Marca = MARCA_POR_DEFECTO,
): Metadata {
  if (!plan) return construir({ path }, { imagenPropia: true }, marca);

  const precio = `${formatPrecio(plan.precio_mensual)}/mes`;
  const descripcion = texto(plan.descripcion);

  return construir(
    {
      path,
      title: `Contratar ${plan.nombre_comercial}`,
      description: descripcion
        ? `${plan.nombre_comercial}: ${descripcion} por ${precio}. Internet fibra optica en ${marca.zonaCorta}.`
        : undefined,
      shareTitle: `${plan.nombre_comercial} por ${precio} | ${marca.nombre}`,
    },
    { imagenPropia: true },
    marca,
  );
}
