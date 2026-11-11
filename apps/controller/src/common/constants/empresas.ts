/**
 * Las dos empresas del portal: "plataforma web con servidor único, diferenciada
 * por empresa (Finet y Cable Mágico)" (Documento 0, §6.6). Los ids son los de
 * la tabla `empresa` de la base compartida; las tablas son las mismas para las
 * dos y cada fila dice de qué empresa es, como lo hace G8.
 *
 * Única fuente del backend para lo que cambia entre empresas: nombre visible,
 * región del prospecto y prefijo del sitio. Lo visual del correo vive en
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
