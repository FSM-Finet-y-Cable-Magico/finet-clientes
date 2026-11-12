import { describe, it, expect } from '@jest/globals';
import {
  contenidoComprobante,
  generarComprobantePdf,
  type DatosComprobante,
} from './comprobante-pago.pdf.js';

/**
 * CU-52 / RF-38: el comprobante de un pago en PDF, "con el detalle del monto,
 * la fecha y los datos de la empresa", de menos de 500 KB (RNF-38.1). De
 * Finet o de Cable Mágico según el cliente.
 */
function datos(
  idEmpresa: number,
  cambios: Partial<DatosComprobante['pago']> = {},
): DatosComprobante {
  return {
    idEmpresa,
    cliente: { nombre: 'Ana Pérez', rut: '123456785' },
    pago: {
      idPago: 5,
      // 23:11 del 11-11 en Chile.
      fecha: new Date('2026-11-12T02:11:31Z'),
      monto: 50000,
      medio: 'Webpay',
      periodo: 'Noviembre 2026',
      ordenCompra: 'F7-abc123',
      codigoAutorizacion: '1213',
      ...cambios,
    },
    generado: new Date('2026-11-12T03:00:00Z'),
  };
}

describe('contenido del comprobante', () => {
  it('Cable Mágico: sus datos legales y ninguno de Finet', () => {
    const c = contenidoComprobante(datos(2));
    expect(c.empresa).toEqual([
      'Cable Magico Estelar S.A.',
      'RUT 76.620.850-9',
      'Avenida Peñablanca 525, Algarrobo',
      'Teléfono +56 9 3303 1480 · pagos@cablemagico.cl',
    ]);
    expect(JSON.stringify(c)).not.toMatch(/Fibernet|Finet/);
    expect(c.nombreArchivo).toBe('comprobante-cable-magico-5.pdf');
  });

  it('Finet: sin línea de RUT, porque no lo entregó', () => {
    const c = contenidoComprobante(datos(1));
    expect(c.empresa).toEqual([
      'Fibernet Limitada',
      'Avenida Santa Rosa 12980, La Pintana',
      'Teléfono +56 9 4500 2319',
    ]);
    expect(c.nombreArchivo).toBe('comprobante-finet-5.pdf');
  });

  it('el detalle del pago: cliente, período, fecha en hora de Chile, medio y códigos', () => {
    const c = contenidoComprobante(datos(2));
    expect(c.titulo).toBe('Comprobante de pago N° 5');
    expect(c.filas).toEqual([
      ['Cliente', 'Ana Pérez'],
      ['RUT del cliente', '12345678-5'],
      ['Período pagado', 'Noviembre 2026'],
      ['Fecha del pago', '11/11/2026 23:11'],
      ['Medio de pago', 'Webpay'],
      ['Orden de compra', 'F7-abc123'],
      ['Código de autorización', '1213'],
    ]);
    expect(c.total).toEqual(['Monto pagado', '$50.000']);
  });

  it('lo que el pago no trae no aparece', () => {
    const c = contenidoComprobante(
      datos(1, { periodo: null, ordenCompra: null, codigoAutorizacion: null }),
    );
    expect(c.filas.map(([etiqueta]) => etiqueta)).toEqual([
      'Cliente',
      'RUT del cliente',
      'Fecha del pago',
      'Medio de pago',
    ]);
  });

  it('dice que no es una boleta y cuándo se generó', () => {
    const c = contenidoComprobante(datos(2));
    expect(c.pie).toEqual([
      'Este comprobante acredita un pago en línea recibido por Cable Magico Estelar S.A. No es una boleta ni una factura electrónica.',
      'Generado el 12/11/2026 00:00 desde el Portal de Clientes de Cable Mágico.',
    ]);
  });
});

describe('el PDF', () => {
  it.each([1, 2])(
    'de la empresa %i es un PDF completo de menos de 500 KB',
    async (idEmpresa) => {
      const pdf = await generarComprobantePdf(datos(idEmpresa));
      expect(pdf.subarray(0, 5).toString()).toBe('%PDF-');
      expect(pdf.toString('latin1').trimEnd().endsWith('%%EOF')).toBe(true);
      expect(pdf.length).toBeLessThan(500 * 1024);
    },
  );
});
