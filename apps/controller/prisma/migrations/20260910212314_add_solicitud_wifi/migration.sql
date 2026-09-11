-- CU-31 / CU-32: solicitud de cambio de clave WiFi.
--
-- El portal solo REGISTRA la solicitud; la ejecucion contra el equipo del
-- cliente corre por cuenta del CRM (CU-33). Por eso `password_nueva` se guarda
-- legible y no hasheada: CU-33 exige que quien la aplique vea "la nueva clave
-- validada". `estado` permite que CU-33 Excepcion 2 deje la solicitud como
-- 'pendiente' cuando falla al aplicarla en el equipo.

-- CreateTable
CREATE TABLE "solicitud_wifi" (
    "id_solicitud" SERIAL NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "password_nueva" VARCHAR(63) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "fecha_solicitud" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesada" TIMESTAMP(6),

    CONSTRAINT "solicitud_wifi_pkey" PRIMARY KEY ("id_solicitud")
);

-- AddForeignKey
ALTER TABLE "solicitud_wifi" ADD CONSTRAINT "fk_solicitud_wifi_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_wifi" ADD CONSTRAINT "fk_solicitud_wifi_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
