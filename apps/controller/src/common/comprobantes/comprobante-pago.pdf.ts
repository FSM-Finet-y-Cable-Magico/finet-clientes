import PDFDocument from 'pdfkit';
import { empresaDe } from '../constants/empresas.js';
import { formatRut } from '../utils/rut.js';
import { fechaHoraCliente, pesos } from '../../mail/formato.js';
import { logoCorreoDe } from '../../mail/logo-correo.js';
import { COLOR, marcaCorreoDe } from '../../mail/plantilla-correo.js';

/**
 * CU-52 / RF-38: el comprobante de un pago en PDF, "con el detalle del monto,
 * la fecha y los datos de la empresa", generado en el servidor y de menos de
 * 500 KB (RNF-38.1). Lleva la marca de la empresa del cliente: el mismo logo y
 * colores que sus correos.
 *
 * No es la boleta del SII: esa la iba a emitir G8 (`tax-document`), que no la
 * implementó. Por eso el pie lo dice.
 */

export type DatosComprobante = {
  /** La empresa del cliente (1 Finet, 2 Cable Mágico). */
  readonly idEmpresa: number | null;
  readonly cliente: { readonly nombre: string; readonly rut: string };
  readonly pago: {
    readonly idPago: number;
    readonly fecha: Date;
    readonly monto: number;
    /** Como se le muestra al cliente: "Webpay". */
    readonly medio: string;
    /** "Noviembre 2026", si el pago tiene factura. */
    readonly periodo: string | null;
    /** La orden de compra de Webpay (`pago.codigo_transaccion`). */
    readonly ordenCompra: string | null;
    readonly codigoAutorizacion: string | null;
  };
  /** Cuándo se generó: va en el pie. */
  readonly generado: Date;
};

export type ContenidoComprobante = {
  readonly nombreArchivo: string;
  /** Razón social, RUT (si lo tiene), dirección y contacto. */
  readonly empresa: readonly string[];
  readonly titulo: string;
  readonly filas: readonly (readonly [string, string])[];
  readonly total: readonly [string, string];
  readonly pie: readonly string[];
};

/** Lo que dice el comprobante, separado del dibujo para poder probarlo. */
export function contenidoComprobante(
  datos: DatosComprobante,
): ContenidoComprobante {
  const empresa = empresaDe(datos.idEmpresa);
  const { pago, cliente } = datos;
  const contacto = [`Teléfono ${empresa.telefono}`, empresa.correo]
    .filter(Boolean)
    .join(' · ');

  const filas: [string, string][] = [
    ['Cliente', cliente.nombre],
    ['RUT del cliente', formatRut(cliente.rut)],
  ];
  if (pago.periodo) filas.push(['Período pagado', pago.periodo]);
  filas.push(['Fecha del pago', fechaHoraCliente(pago.fecha)]);
  filas.push(['Medio de pago', pago.medio]);
  if (pago.ordenCompra) filas.push(['Orden de compra', pago.ordenCompra]);
  if (pago.codigoAutorizacion) {
    filas.push(['Código de autorización', pago.codigoAutorizacion]);
  }

  return {
    nombreArchivo: `comprobante-${empresa.slug}-${pago.idPago}.pdf`,
    empresa: [
      empresa.razonSocial,
      ...(empresa.rut ? [`RUT ${empresa.rut}`] : []),
      empresa.direccion,
      contacto,
    ],
    titulo: `Comprobante de pago N° ${pago.idPago}`,
    filas,
    total: ['Monto pagado', pesos(pago.monto)],
    pie: [
      // Sin punto doble con una razón social que termina en punto ("S.A.").
      `Este comprobante acredita un pago en línea recibido por ${empresa.razonSocial.replace(/\.$/, '')}. No es una boleta ni una factura electrónica.`,
      `Generado el ${fechaHoraCliente(datos.generado)} desde el Portal de Clientes de ${empresa.nombre}.`,
    ],
  };
}

const MARGEN = 48;
const ALTO_CABECERA = 96;

/** El comprobante en PDF (A4), con el logo y los colores de la empresa. */
export function generarComprobantePdf(
  datos: DatosComprobante,
): Promise<Buffer> {
  const c = contenidoComprobante(datos);
  const { tema } = marcaCorreoDe(datos.idEmpresa);
  const logo = logoCorreoDe(datos.idEmpresa).adjunto.content;

  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: MARGEN,
      info: {
        Title: c.titulo,
        Author: c.empresa[0],
        Creator: 'Portal de Clientes',
      },
    });
    const partes: Buffer[] = [];
    doc.on('data', (parte: Buffer) => partes.push(parte));
    doc.on('end', () => resolve(Buffer.concat(partes)));
    doc.on('error', reject);

    const ancho = doc.page.width - MARGEN * 2;

    // Cabecera con el logo, como la de sus correos.
    doc.rect(0, 0, doc.page.width, ALTO_CABECERA).fill(tema.cabecera);
    if (tema.franja) {
      doc.rect(0, ALTO_CABECERA, doc.page.width, 4).fill(tema.franja);
    }
    if (Buffer.isBuffer(logo)) {
      doc.image(logo, MARGEN, 18, { fit: [160, 60], valign: 'center' });
    }

    // Los datos de la empresa.
    doc
      .font('Helvetica-Bold')
      .fontSize(11)
      .fillColor(COLOR.texto)
      .text(c.empresa[0], MARGEN, ALTO_CABECERA + 28);
    doc
      .font('Helvetica')
      .fontSize(9)
      .fillColor(COLOR.suave)
      .text(c.empresa.slice(1).join('\n'), { lineGap: 2 });

    // Título.
    doc.moveDown(2);
    doc.font('Helvetica-Bold').fontSize(20).fillColor(COLOR.texto);
    doc.text(c.titulo, MARGEN, doc.y);
    doc.moveDown(1.2);

    // El detalle, una fila por dato.
    const fila = (
      etiqueta: string,
      valor: string,
      { destacada }: { destacada: boolean },
    ) => {
      const y = doc.y;
      doc
        .moveTo(MARGEN, y)
        .lineTo(MARGEN + ancho, y)
        .lineWidth(0.6)
        .strokeColor(COLOR.borde)
        .stroke();
      const tamano = destacada ? 13 : 10;
      doc
        .font(destacada ? 'Helvetica-Bold' : 'Helvetica')
        .fontSize(tamano)
        .fillColor(destacada ? COLOR.texto : COLOR.suave)
        .text(etiqueta, MARGEN, y + 9, { width: ancho / 2 });
      doc
        .font('Helvetica-Bold')
        .fontSize(tamano)
        .fillColor(destacada ? tema.enlace : COLOR.texto)
        .text(valor, MARGEN + ancho / 2, y + 9, {
          width: ancho / 2,
          align: 'right',
        });
      doc.y = y + tamano + 20;
    };
    for (const [etiqueta, valor] of c.filas) {
      fila(etiqueta, valor, { destacada: false });
    }
    fila(c.total[0], c.total[1], { destacada: true });

    // Pie.
    doc.moveDown(2);
    doc.font('Helvetica').fontSize(8.5).fillColor(COLOR.suave);
    doc.text(c.pie.join('\n'), MARGEN, doc.y, { width: ancho, lineGap: 3 });

    doc.end();
  });
}
