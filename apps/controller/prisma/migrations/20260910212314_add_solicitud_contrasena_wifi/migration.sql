-- CU-31 / CU-32: solicitud de cambio de contrasena de la red WiFi.
--
-- Nombre de tabla explicito (pedido de Dani en el review de esta rama):
-- `solicitud_wifi` no distinguia esta solicitud de cualquier otra sobre el
-- WiFi (instalacion, cambio de equipo, cobertura). Sin enie, como el resto
-- del esquema.
--
-- El portal solo REGISTRA la solicitud; la ejecucion contra el equipo del
-- cliente corre por cuenta del CRM (CU-33). `estado` permite que CU-33
-- Excepcion 2 deje la solicitud como 'PENDIENTE' cuando falla al aplicarla
-- en el equipo.
--
-- Catalogo de `estado`: PENDIENTE | APLICADA | FALLIDA, en MAYUSCULAS por la
-- convencion del §11.15 del Documento 0 (ahi todo catalogo cerrado va asi:
-- ACTIVO, ABIERTO, MEDIA...). El portal solo escribe PENDIENTE; las otras dos
-- las escribe el CRM al ejecutar CU-33. Falta agregar esta fila al §11.15:
-- queda pedido en CAMBIOS-PARA-EQUIPO-DOCUMENTACION.md.
--
-- `password_nueva_hash` guarda hash bcrypt (cost 10), nunca texto plano
-- (pedido de Dani en el mismo review). VARCHAR(72) igual que
-- password_portal_hash y password_tvip_hash: bcrypt ocupa 60.
--
-- OJO CU-33: bcrypt no es reversible, asi que desde esta tabla ya no se puede
-- leer la clave que el tecnico debe aplicar en el equipo. CU-33 queda
-- necesitando otra via para obtenerla (pedirsela al cliente al aplicar el
-- cambio, o cambiar este campo a cifrado reversible con manejo de llaves).
-- El hash sirve para verificar despues que la clave aplicada es la que el
-- cliente pidio, no para recuperarla.

-- CreateTable
CREATE TABLE "solicitud_contrasena_wifi" (
    "id_solicitud" SERIAL NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "password_nueva_hash" VARCHAR(72) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "fecha_solicitud" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesada" TIMESTAMP(6),

    CONSTRAINT "solicitud_contrasena_wifi_pkey" PRIMARY KEY ("id_solicitud")
);

-- AddForeignKey
ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
