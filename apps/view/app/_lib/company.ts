/**
 * Datos de contacto e identidad de cada empresa del portal, centralizados:
 * "plataforma web con servidor único, diferenciada por empresa (Finet y Cable
 * Mágico)" (Documento 0, §6.6). Única fuente de la vista; edita SOLO este
 * archivo para cambiar teléfono, WhatsApp, dirección, razón social o marca.
 *
 * Finet vive en la raíz del sitio y Cable Mágico bajo `/cable-magico`,
 * mientras no tenga su propio host (ver `URL_CABLE_MAGICO`). El `idEmpresa` es
 * el de la tabla `empresa` de la base compartida.
 *
 * Los `null` son datos que todavía no entrega la empresa: las páginas legales
 * (CU-73) muestran el hueco marcado. Están listados en "Pendientes del CU-73"
 * de docs/CASOS-DE-USO.md; al completarlos, sacarlos de esa lista.
 */

import { BASE_URL } from "./consts";

type Telefono = {
  /** E.164 sin "+" ni espacios: el que usa wa.me. */
  readonly e164: string;
  /** Para mostrar. */
  readonly display: string;
  /** Para enlaces `tel:`. */
  readonly tel: string;
};

export type Marca = {
  readonly slug: string;
  readonly idEmpresa: number;
  /** La URL base de su sitio, sin barra final. */
  readonly url: string;
  /** Dónde vive dentro de ese sitio: en la raíz, o bajo su prefijo si lo comparte. */
  readonly prefijo: "" | `/${string}`;
  /** Nombre comercial. */
  readonly nombre: string;
  readonly razonSocial: string;
  /**
   * Se muestra si la empresa lo entregó: ninguna norma que aplique al Portal lo
   * exige. El DS 6/2021 no, porque aquí no se contrata (art. 3 N° 4).
   */
  readonly rut: string | null;
  /** Ley 19.628, art. 14 ter b), según la Ley 21.719: va en la Política de Privacidad. */
  readonly representanteLegal: string | null;
  readonly logo: {
    readonly webp: string;
    readonly png: string;
    readonly alt: string;
    readonly ancho: number;
    readonly alto: number;
  };
  /** El ícono de la pestaña del navegador. */
  readonly icono: string;
  readonly telefono: Telefono;
  readonly whatsappUrl: string;
  readonly instagramUrl: string;
  /**
   * Contacto general: reclamos, término de contrato, accesos indebidos. Si no
   * lo hay, no se pide: en el DS 194, art. 5, el correo es opcional.
   */
  readonly correoContacto: string | null;
  /** Si la empresa lo tiene, se suma al WhatsApp para las solicitudes sobre datos personales. */
  readonly correoPrivacidad: string | null;
  readonly direccion: {
    /** Calle y número del domicilio legal. */
    readonly calle: string | null;
    readonly comuna: string;
    readonly region: string;
    readonly pais: "CL";
  };
  /** Comunas donde da servicio. */
  readonly comunas: readonly string[];
  /** "La Pintana, Puente Alto, La Florida y La Granja". */
  readonly zonaTexto: string;
  /** Para títulos cortos: "La Pintana y Puente Alto". */
  readonly zonaCorta: string;
  /** "la zona sur de Santiago". */
  readonly zonaRegion: string;
  /** Dónde está su atención presencial. */
  readonly comunaSoporte: string;
  /** Horario de atención, si la empresa lo informó. */
  readonly horario: string | null;
};

function telefono(e164: string, display: string): Telefono {
  return { e164, display, tel: `+${e164}` };
}

/**
 * El host propio de Cable Mágico, si lo tiene. Hoy no hay dominios: sin esta
 * variable los dos sitios comparten host y Cable Mágico va bajo su prefijo.
 * Con ella vive en la raíz de ese host, sin prefijo, y `proxy.ts` lo reconoce
 * por el host. Es `NEXT_PUBLIC_` porque los enlaces también se arman en el
 * navegador.
 */
const URL_CABLE_MAGICO =
  process.env.NEXT_PUBLIC_SITE_URL_CABLE_MAGICO?.replace(/\/+$/, "") || null;

const TELEFONO_FINET = telefono("56945002319", "+56 9 4500 2319");
const TELEFONO_CABLE_MAGICO = telefono("56933031480", "+56 9 3303 1480");

export const MARCAS = {
  finet: {
    slug: "finet",
    idEmpresa: 1,
    url: BASE_URL,
    prefijo: "",
    nombre: "Finet",
    razonSocial: "Fibernet Limitada",
    rut: null,
    representanteLegal: null,
    logo: {
      webp: "/brand/FinetLogo.webp",
      png: "/brand/FinetLogo.png",
      alt: "Finet — Internet y TV",
      ancho: 120,
      alto: 40,
    },
    icono: "/favicon.ico",
    telefono: TELEFONO_FINET,
    whatsappUrl: `https://wa.me/${TELEFONO_FINET.e164}`,
    instagramUrl: "https://www.instagram.com/finettcl/",
    correoContacto: null,
    correoPrivacidad: null,
    direccion: {
      calle: "Avenida Santa Rosa 12980",
      comuna: "La Pintana",
      region: "Region Metropolitana",
      pais: "CL",
    },
    comunas: ["La Pintana", "Puente Alto", "La Florida", "La Granja"],
    zonaTexto: "La Pintana, Puente Alto, La Florida y La Granja",
    zonaCorta: "La Pintana y Puente Alto",
    zonaRegion: "la zona sur de Santiago",
    comunaSoporte: "La Pintana",
    horario: null,
  },
  // Datos que entregó Cable Mágico el 11-11 (razón social, RUT, dirección,
  // teléfono, correo y horario de su WhatsApp de empresa).
  "cable-magico": {
    slug: "cable-magico",
    idEmpresa: 2,
    url: URL_CABLE_MAGICO ?? BASE_URL,
    prefijo: URL_CABLE_MAGICO ? "" : "/cable-magico",
    nombre: "Cable Mágico",
    razonSocial: "Cable Magico Estelar S.A.",
    rut: "76.620.850-9",
    representanteLegal: null,
    logo: {
      webp: "/brand/CableMagicoLogo.webp",
      png: "/brand/CableMagicoLogo.png",
      alt: "Cable Mágico — Internet y TV",
      ancho: 72,
      alto: 72,
    },
    icono: "/brand/CableMagicoIcon.png",
    telefono: TELEFONO_CABLE_MAGICO,
    whatsappUrl: `https://wa.me/${TELEFONO_CABLE_MAGICO.e164}`,
    instagramUrl: "https://www.instagram.com/cablemagicoestelar/",
    correoContacto: "pagos@cablemagico.cl",
    correoPrivacidad: null,
    direccion: {
      calle: "Avenida Peñablanca 525",
      comuna: "Algarrobo",
      region: "Region de Valparaiso",
      pais: "CL",
    },
    comunas: ["Algarrobo", "El Quisco"],
    zonaTexto: "Algarrobo y El Quisco",
    zonaCorta: "Algarrobo y El Quisco",
    zonaRegion: "el litoral central",
    comunaSoporte: "Algarrobo",
    horario: "9:00 a 17:00",
  },
} as const satisfies Record<string, Marca>;

export type SlugMarca = keyof typeof MARCAS;

export const SLUGS_MARCA = Object.keys(MARCAS) as SlugMarca[];

/** La marca que se usa si una ruta o un dato no trae una conocida. */
export const MARCA_POR_DEFECTO: Marca = MARCAS.finet;

export function esSlugMarca(valor: unknown): valor is SlugMarca {
  return typeof valor === "string" && Object.hasOwn(MARCAS, valor);
}

export function marcaPorSlug(slug: string | null | undefined): Marca {
  return esSlugMarca(slug) ? MARCAS[slug] : MARCA_POR_DEFECTO;
}

/** La marca de una empresa de la base (la del cliente o del plan). */
export function marcaPorEmpresa(idEmpresa: number | null | undefined): Marca {
  return (
    Object.values(MARCAS).find((m) => m.idEmpresa === idEmpresa) ??
    MARCA_POR_DEFECTO
  );
}

/** Una ruta del sitio de la marca: lleva su prefijo, si lo tiene. */
export function rutaMarca(marca: Marca, ruta: `/${string}`): string {
  if (!marca.prefijo) return ruta;
  return ruta === "/" ? marca.prefijo : `${marca.prefijo}${ruta}`;
}

/** La URL completa de una ruta del sitio de la marca. */
export function urlMarca(marca: Marca, ruta: `/${string}`): string {
  const camino = rutaMarca(marca, ruta);
  return camino === "/" ? marca.url : `${marca.url}${camino}`;
}

/**
 * El enlace a una ruta del sitio de `destino` desde el sitio de `actual`: si
 * comparten host basta la ruta; si no, la URL completa del otro host.
 */
export function enlaceEntreSitios(
  actual: Marca,
  destino: Marca,
  ruta: `/${string}`,
): string {
  return destino.url === actual.url
    ? rutaMarca(destino, ruta)
    : urlMarca(destino, ruta);
}

// Falla al cargar (y en el build) si una URL del .env está mal escrita.
const HOSTS = Object.values(MARCAS).map(
  (marca) => [new URL(marca.url).host, marca] as const,
);

/**
 * La marca dueña de ese host. La lista es cerrada, los hosts de las URLs
 * configuradas: lo que mande el navegador en `Host` solo elige entre ellas y
 * nunca se usa para armar una URL. `null` si el host no es de ninguna o si lo
 * comparten, que es lo que pasa mientras Cable Mágico va por prefijo.
 */
export function marcaPorHost(host: string | null | undefined): Marca | null {
  const suyas = HOSTS.filter(([h]) => h === host?.toLowerCase());
  return suyas.length === 1 ? suyas[0][1] : null;
}

/**
 * Un enlace de la configuración (barra, pie): los internos van al sitio de la
 * marca; los externos (http, wa.me) quedan igual.
 */
export function hrefMarca(marca: Marca, href: string): string {
  return href.startsWith("/") && !href.startsWith("//")
    ? rutaMarca(marca, href as `/${string}`)
    : href;
}

/** La marca de una ruta del navegador y la ruta sin su prefijo. */
export function separarMarca(pathname: string): { marca: Marca; ruta: string } {
  for (const marca of Object.values(MARCAS)) {
    if (!marca.prefijo) continue;
    if (pathname === marca.prefijo) return { marca, ruta: "/" };
    if (pathname.startsWith(`${marca.prefijo}/`)) {
      return { marca, ruta: pathname.slice(marca.prefijo.length) };
    }
  }
  return { marca: MARCA_POR_DEFECTO, ruta: pathname };
}
