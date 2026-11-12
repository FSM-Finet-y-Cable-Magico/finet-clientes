import { escaparHtml } from './formato.js';
import { logoCorreoDe } from './logo-correo.js';
import {
  empresaDe,
  esEmpresaConocida,
  ID_EMPRESA_POR_DEFECTO,
  type IdEmpresa,
} from '../common/constants/empresas.js';

/**
 * Molde común de los correos del portal, con los colores del portal
 * (`apps/view/app/globals.css`) y la marca de la empresa del cliente: lo que
 * le llega a Cable Mágico es de Cable Mágico (Emilio, 11-11).
 *
 * Es HTML de correo, no de página: tablas para el layout y estilos en línea,
 * porque Gmail y Outlook ignoran las hojas de estilo y el flex/grid.
 */

/** Lo que cambia por empresa: la cabecera, el botón y los enlaces. */
type TemaCorreo = {
  readonly cabecera: string;
  /** Franja bajo la cabecera, para separarla cuando es blanca. */
  readonly franja: string | null;
  /** El nombre, si el logo no carga. */
  readonly textoCabecera: string;
  readonly boton: string;
  readonly textoBoton: string;
  readonly enlace: string;
};

const TEMAS: Record<IdEmpresa, TemaCorreo> = {
  1: {
    cabecera: '#0B1C30', // --color-foreground: el logo (cian y amarillo) se lee
    franja: null,
    textoCabecera: '#E3E446',
    // DESIGN.md: "Pagar / Checkout" va en Finet Lime con texto Deep Slate (13:1).
    boton: '#E3E446',
    textoBoton: '#0F172A',
    enlace: '#00687A', // --color-primary-bright: el cian sobre blanco no llega a 3:1
  },
  2: {
    // El logo de Cable Mágico tiene fondo blanco: cabecera blanca con su rojo.
    cabecera: '#FFFFFF',
    franja: '#D7141A',
    textoCabecera: '#B5121B',
    boton: '#D7141A', // el rojo del logo; el blanco encima llega a 5,2:1
    textoBoton: '#FFFFFF',
    enlace: '#B5121B', // 6,9:1 sobre blanco
  },
};

/** La marca con que sale un correo: la de la empresa del cliente. */
export type MarcaCorreo = {
  readonly nombre: string;
  readonly logo: { cid: string; ancho: number; alto: number };
  readonly tema: TemaCorreo;
};

/** La marca de una empresa; si no es conocida, la de Finet. */
export function marcaCorreoDe(
  idEmpresa: number | null | undefined,
): MarcaCorreo {
  const id = esEmpresaConocida(idEmpresa) ? idEmpresa : ID_EMPRESA_POR_DEFECTO;
  const { adjunto, ancho, alto } = logoCorreoDe(id);
  return {
    nombre: empresaDe(id).nombre,
    logo: { cid: adjunto.cid, ancho, alto },
    tema: TEMAS[id],
  };
}

/** Colores del molde, compartidos con el comprobante en PDF. */
export const COLOR = {
  fondo: '#EFF4FF', // --color-surface
  texto: '#0B1C30',
  suave: '#6D797D', // --color-muted
  borde: '#E2E8F0',
};

const TONOS = {
  alerta: { texto: '#93000A', fondo: '#FFDAD6' }, // --color-*-error-container
  exito: { texto: '#00210A', fondo: '#B6F2C2' }, // --color-*-success-container
  aviso: { texto: '#001F26', fondo: '#ACEDFF' }, // --color-*-info-container
};

const FUENTE =
  "'Hanken Grotesk', 'Helvetica Neue', Helvetica, Arial, sans-serif";

export type Correo = {
  /** Lo que el buzón muestra al lado del asunto, antes de abrirlo. */
  resumen: string;
  etiqueta: { texto: string; tono: keyof typeof TONOS };
  titulo: string;
  /** HTML ya escapado: lo arma quien llama. */
  cuerpo: string;
  boton?: { texto: string; enlace: string };
  marca: MarcaCorreo;
};

export function plantillaCorreo(c: Correo): string {
  const tono = TONOS[c.etiqueta.tono];
  const { nombre, logo: l, tema } = c.marca;
  // Si el cliente bloquea las imágenes, el texto alternativo dice la marca.
  const logo = `<img src="cid:${escaparHtml(l.cid)}" width="${l.ancho}" height="${l.alto}" alt="${escaparHtml(nombre)}" style="display:block;border:0;height:auto;color:${tema.textoCabecera};font:700 24px ${FUENTE};">`;
  const franja = tema.franja ? `border-bottom:4px solid ${tema.franja};` : '';

  const boton = c.boton
    ? `
          <tr><td style="padding:8px 0 4px;">
            <a href="${escaparHtml(c.boton.enlace)}" style="display:block;background:${tema.boton};color:${tema.textoBoton};text-align:center;text-decoration:none;font:700 17px ${FUENTE};padding:16px 24px;border-radius:12px;">${escaparHtml(c.boton.texto)}</a>
          </td></tr>
          <tr><td style="padding:12px 0 0;font:13px/1.5 ${FUENTE};color:${COLOR.suave};">
            ¿No funciona el botón? Copia este enlace en tu navegador:<br>
            <a href="${escaparHtml(c.boton.enlace)}" style="color:${tema.enlace};word-break:break-all;">${escaparHtml(c.boton.enlace)}</a>
          </td></tr>`
    : '';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escaparHtml(c.titulo)}</title>
</head>
<body style="margin:0;padding:0;background:${COLOR.fondo};">
<div style="display:none;max-height:0;overflow:hidden;">${escaparHtml(c.resumen)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${COLOR.fondo};">
  <tr><td align="center" style="padding:24px 12px;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#FFFFFF;border-radius:16px;overflow:hidden;border:1px solid ${COLOR.borde};">
      <tr><td style="background:${tema.cabecera};padding:20px 28px;${franja}">${logo}</td></tr>
      <tr><td style="padding:32px 28px 28px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
          <tr><td style="padding-bottom:16px;">
            <span style="display:inline-block;background:${tono.fondo};color:${tono.texto};font:700 12px ${FUENTE};letter-spacing:0.6px;text-transform:uppercase;padding:6px 12px;border-radius:999px;">${escaparHtml(c.etiqueta.texto)}</span>
          </td></tr>
          <tr><td style="padding-bottom:12px;font:800 26px/1.25 ${FUENTE};color:${COLOR.texto};">${escaparHtml(c.titulo)}</td></tr>
          <tr><td style="padding-bottom:20px;font:16px/1.6 ${FUENTE};color:${COLOR.texto};">${c.cuerpo}</td></tr>${boton}
        </table>
      </td></tr>
      <tr><td style="padding:18px 28px;border-top:1px solid ${COLOR.borde};font:12px/1.5 ${FUENTE};color:${COLOR.suave};">
        Este es un aviso automático de ${escaparHtml(nombre)}. No respondas a este correo.
      </td></tr>
    </table>
  </td></tr>
</table>
</body>
</html>`;
}

/** Los datos de un pago como comprobante: etiqueta a la izquierda, valor a la derecha. */
export function comprobante(filas: [string, string][]): string {
  const cuerpo = filas
    .map(
      ([etiqueta, valor], i) => `
      <tr>
        <td style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${COLOR.borde};` : ''}font:14px ${FUENTE};color:${COLOR.suave};">${escaparHtml(etiqueta)}</td>
        <td align="right" style="padding:12px 16px;${i > 0 ? `border-top:1px solid ${COLOR.borde};` : ''}font:700 15px ${FUENTE};color:${COLOR.texto};white-space:nowrap;">${escaparHtml(valor)}</td>
      </tr>`,
    )
    .join('');
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin-top:16px;background:${COLOR.fondo};border-radius:12px;">${cuerpo}
    </table>`;
}
