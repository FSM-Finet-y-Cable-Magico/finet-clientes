/**
 * Datos de contacto e identidad de cada empresa del portal, centralizados:
 * "plataforma web con servidor único, diferenciada por empresa (Finet y Cable
 * Mágico)" (Documento 0, §6.6). Única fuente de la vista; edita SOLO este
 * archivo para cambiar teléfono, WhatsApp, dirección, razón social o marca.
 *
 * Finet vive en la raíz del sitio y Cable Mágico bajo `/cable-magico`. El
 * `idEmpresa` es el de la tabla `empresa` de la base compartida.
 *
 * Los `null` son datos que todavía no entrega la empresa: las páginas legales
 * (CU-73) muestran el hueco marcado. Están listados en "Pendientes del CU-73"
 * de docs/CASOS-DE-USO.md; al completarlos, sacarlos de esa lista.
 */

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
  /** Dónde vive su sitio: Finet en la raíz. */
  readonly prefijo: "" | `/${string}`;
  /** Nombre comercial. */
  readonly nombre: string;
  readonly razonSocial: string;
  readonly rut: string | null;
  readonly logo: {
    readonly webp: string;
    readonly png: string;
    readonly alt: string;
    readonly ancho: number;
    readonly alto: number;
  };
  readonly telefono: Telefono;
  readonly whatsappUrl: string;
  readonly instagramUrl: string;
  /** Contacto general: reclamos, término de contrato, accesos indebidos. */
  readonly correoContacto: string | null;
  /** Para ejercer los derechos sobre datos personales. */
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

const TELEFONO_FINET = telefono("56945002319", "+56 9 4500 2319");
const TELEFONO_CABLE_MAGICO = telefono("56933031480", "+56 9 3303 1480");

export const MARCAS = {
  finet: {
    slug: "finet",
    idEmpresa: 1,
    prefijo: "",
    nombre: "Finet",
    razonSocial: "Fibernet Limitada",
    rut: null,
    logo: {
      webp: "/brand/FinetLogo.webp",
      png: "/brand/FinetLogo.png",
      alt: "Finet — Internet y TV",
      ancho: 120,
      alto: 40,
    },
    telefono: TELEFONO_FINET,
    whatsappUrl: `https://wa.me/${TELEFONO_FINET.e164}`,
    instagramUrl: "https://www.instagram.com/finettcl/",
    correoContacto: null,
    correoPrivacidad: null,
    direccion: {
      calle: null,
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
    prefijo: "/cable-magico",
    nombre: "Cable Mágico",
    razonSocial: "Cable Magico Estelar S.A.",
    rut: "76.620.850-9",
    logo: {
      webp: "/brand/CableMagicoLogo.webp",
      png: "/brand/CableMagicoLogo.png",
      alt: "Cable Mágico — Internet y TV",
      ancho: 72,
      alto: 72,
    },
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

/** Una ruta del sitio de la marca: Cable Mágico lleva su prefijo. */
export function rutaMarca(marca: Marca, ruta: `/${string}`): string {
  if (!marca.prefijo) return ruta;
  return ruta === "/" ? marca.prefijo : `${marca.prefijo}${ruta}`;
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

/*
 * Transición: los nombres anteriores, derivados de Finet, mientras cada
 * pantalla pasa a usar la marca de su página. Se borran al terminar.
 */
export const COMPANY_LEGAL_NAME = MARCAS.finet.razonSocial;
export const COMPANY_BRAND = MARCAS.finet.nombre;
export const COMPANY_PHONE_E164 = MARCAS.finet.telefono.e164;
export const COMPANY_PHONE_DISPLAY = MARCAS.finet.telefono.display;
export const COMPANY_PHONE_TEL = MARCAS.finet.telefono.tel;
export const WHATSAPP_URL = MARCAS.finet.whatsappUrl;
export const COMPANY_RUT: string | null = MARCAS.finet.rut;
export const COMPANY_STREET_ADDRESS: string | null = MARCAS.finet.direccion.calle;
export const COMPANY_CONTACT_EMAIL: string | null = MARCAS.finet.correoContacto;
export const COMPANY_PRIVACY_EMAIL: string | null = MARCAS.finet.correoPrivacidad;
export const COMPANY_ADDRESS = {
  locality: MARCAS.finet.direccion.comuna,
  region: MARCAS.finet.direccion.region,
  country: MARCAS.finet.direccion.pais,
} as const;
