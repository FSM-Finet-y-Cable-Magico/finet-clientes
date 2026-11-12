/**
 * Cómo va el comprobante dentro de `pago.comprobante_pdf_url` (CU-52): el PDF
 * entero como data URL. Es la única columna de la base compartida para el
 * comprobante, y no hay almacenamiento en la nube (Emilio, 12-11: "hay que
 * guardarlo en esa tabla").
 */
export const PREFIJO_PDF_GUARDADO = 'data:application/pdf;base64,';

/** RNF-38.1: el comprobante pesa menos de 500 KB. Uno más grande no se acepta. */
export const TOPE_PDF_BYTES = 500 * 1024;
