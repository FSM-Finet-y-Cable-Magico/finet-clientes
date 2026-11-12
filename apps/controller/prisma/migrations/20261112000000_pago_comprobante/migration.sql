-- Campos de G8 en pago que ya existen en finet_global_validacion: el código de
-- autorización de Transbank y el estado del comprobante (CU-52).
-- Solo para la base propia. En la base compartida nunca se corre una migración.

-- AlterTable
ALTER TABLE "pago" ADD COLUMN "codigo_autorizacion" VARCHAR(100);
ALTER TABLE "pago" ADD COLUMN "comprobante_estado" VARCHAR(20) NOT NULL DEFAULT 'PENDIENTE';
ALTER TABLE "pago" ADD CONSTRAINT "pago_comprobante_estado_check"
    CHECK ("comprobante_estado" IN ('PENDIENTE', 'GENERADO', 'FALLIDO'));
