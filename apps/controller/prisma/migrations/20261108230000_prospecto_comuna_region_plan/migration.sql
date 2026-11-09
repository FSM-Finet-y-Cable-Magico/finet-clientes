-- Campos que el CRM (G8) usa en prospecto y ya existen en finet_global_validacion.
-- Solo para la base propia. En la base compartida nunca se corre una migración.

-- AlterTable
ALTER TABLE "prospecto" ADD COLUMN "comuna" VARCHAR(80);
ALTER TABLE "prospecto" ADD COLUMN "region" VARCHAR(80);
ALTER TABLE "prospecto" ADD COLUMN "id_plan_interes" INTEGER;
