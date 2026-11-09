-- Alinea la base propia del portal con finet_global_validacion (G8, 08-11):
-- las IP son VARCHAR(45) allá, y el ticket WiFi (CU-32, acuerdo v2.0 §6.2) va
-- asociado a un servicio contratado.
--
-- Solo para la base propia. En la base compartida nunca se corre una migración.

-- AlterTable
ALTER TABLE "intento_fallido" ALTER COLUMN "ip_address" TYPE VARCHAR(45) USING host("ip_address");
ALTER TABLE "log_auditoria" ALTER COLUMN "ip_origen" TYPE VARCHAR(45) USING host("ip_origen");
ALTER TABLE "sesion_portal" ALTER COLUMN "ip_origen" TYPE VARCHAR(45) USING host("ip_origen");

-- CreateTable
CREATE TABLE "servicio_contratado" (
    "id_servicio" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "id_empresa" INTEGER,
    "id_contrato" INTEGER,
    "tipo_servicio" VARCHAR(40) NOT NULL,
    "estado_operativo" VARCHAR(30) NOT NULL,

    CONSTRAINT "servicio_contratado_pkey" PRIMARY KEY ("id_servicio")
);

-- AlterTable
ALTER TABLE "ticket" ADD COLUMN "id_servicio" INTEGER;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "fk_ticket_id_servicio" FOREIGN KEY ("id_servicio") REFERENCES "servicio_contratado"("id_servicio") ON DELETE NO ACTION ON UPDATE NO ACTION;
