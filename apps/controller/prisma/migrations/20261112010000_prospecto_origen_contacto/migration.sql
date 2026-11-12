-- Origen de contacto del prospecto, que G8 ya tiene en finet_global_validacion
-- (formato de su registro de prospectos, 12-11).
-- Solo para la base propia. En la base compartida nunca se corre una migración.

-- AlterTable
ALTER TABLE "prospecto" ADD COLUMN "origen_contacto" VARCHAR(40);
