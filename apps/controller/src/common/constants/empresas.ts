/**
 * Las dos empresas del portal: "plataforma web con servidor único, diferenciada
 * por empresa (Finet y Cable Mágico)" (Documento 0, §6.6). Los ids son los de
 * la tabla `empresa` de la base compartida; las tablas son las mismas para las
 * dos y cada fila dice de qué empresa es, como lo hace G8.
 *
 * Única fuente del backend para lo que cambia entre empresas: nombre visible,
 * región del prospecto y dónde vive su sitio. Lo visual del correo vive en
 * `mail/`.
 */

export type Empresa = {
  readonly idEmpresa: number;
  /** Como se ve en el sitio y en los correos. */
  readonly nombre: string;
  /** Región que se escribe en el prospecto (CU-18), como la guarda G8. */
  readonly region: string;
  /** Dónde vive su sitio dentro del portal: Finet en la raíz. */
  readonly prefijoWeb: string;
  /** La variable del .env con la URL de su propio host, si llega a tenerlo. */
  readonly variableSitio?: string;
};

export const EMPRESAS = {
  1: {
    idEmpresa: 1,
    nombre: 'Finet',
    region: 'Metropolitana de Santiago',
    prefijoWeb: '',
  },
  2: {
    idEmpresa: 2,
    nombre: 'Cable Mágico',
    region: 'Valparaíso',
    prefijoWeb: '/cable-magico',
    variableSitio: 'FRONTEND_URL_CABLE_MAGICO',
  },
} as const satisfies Record<number, Empresa>;

export type IdEmpresa = keyof typeof EMPRESAS;

/** La empresa que se asume si un dato no trae una conocida. */
export const ID_EMPRESA_POR_DEFECTO: IdEmpresa = 1;

export function esEmpresaConocida(
  idEmpresa: number | null | undefined,
): idEmpresa is IdEmpresa {
  return idEmpresa != null && Object.hasOwn(EMPRESAS, idEmpresa);
}

/** La empresa de un cliente, plan o prospecto; si no es conocida, Finet. */
export function empresaDe(idEmpresa: number | null | undefined): Empresa {
  return EMPRESAS[
    esEmpresaConocida(idEmpresa) ? idEmpresa : ID_EMPRESA_POR_DEFECTO
  ];
}

/**
 * La URL de una ruta del sitio de la empresa, para los enlaces que se mandan
 * por correo o con que se vuelve de Webpay. `sitio` es `FRONTEND_URL`, el de
 * Finet: Cable Mágico vive ahí bajo su prefijo, salvo que tenga su propio host
 * (`FRONTEND_URL_CABLE_MAGICO`), donde va en la raíz. Es la misma regla que
 * sigue la vista con `NEXT_PUBLIC_SITE_URL_CABLE_MAGICO`.
 */
export function urlDelSitio(
  idEmpresa: number | null | undefined,
  ruta: `/${string}`,
  sitio: string,
): string {
  const { prefijoWeb, variableSitio } = empresaDe(idEmpresa);
  const propio =
    variableSitio && process.env[variableSitio]?.trim().replace(/\/+$/, '');
  return propio ? `${propio}${ruta}` : `${sitio}${prefijoWeb}${ruta}`;
}
