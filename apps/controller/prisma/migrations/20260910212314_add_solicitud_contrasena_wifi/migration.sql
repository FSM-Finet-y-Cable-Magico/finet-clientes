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
-- `password_nueva_cifrada` guarda la clave cifrada con la llave PUBLICA RSA
-- del CRM (RSA-OAEP-SHA256, en base64). Nunca en texto plano: solo el CRM
-- tiene la privada, asi que en esta base no hay nada legible, ni para el
-- portal, ni para un DBA, ni en un dump. Es la via por la que CU-33 obtiene la
-- clave para aplicarla en el equipo via Smart OLT, porque el equipo la
-- necesita en claro (la usa para derivar la PSK de WPA2).
--
-- Es una sola columna a proposito. Se evaluo guardar tambien un hash bcrypt
-- para "verificar", pero ningun CU lo pide y un hash de una clave WiFi corta
-- se saca por diccionario: era un secreto extra guardado para siempre a
-- cambio de nada.
--
-- Contrato con el CRM (Grupo 8), ver CAMBIOS-BD-Y-SOLICITUDES.md:
--   - descifran con su llave privada al aplicar el cambio;
--   - en el MISMO update donde marcan 'APLICADA' dejan
--     password_nueva_cifrada en NULL: con eso la fila deja de guardar
--     cualquier secreto;
--   - si la solicitud queda 'FALLIDA' la columna se mantiene, para reintentar;
--   - si llega en NULL desde el principio, es que el portal no tenia la llave
--     publica configurada: en ese caso hay que pedirle la clave al cliente.
--
-- TEXT y no VARCHAR(n) porque el largo del ciframiento depende del tamano de
-- la llave del CRM (una RSA-4096 da 684 caracteres en base64).

-- CreateTable
CREATE TABLE "solicitud_contrasena_wifi" (
    "id_solicitud" SERIAL NOT NULL,
    "id_contrato" INTEGER NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "password_nueva_cifrada" TEXT,
    "estado" VARCHAR(20) NOT NULL,
    "fecha_solicitud" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_procesada" TIMESTAMP(6),

    CONSTRAINT "solicitud_contrasena_wifi_pkey" PRIMARY KEY ("id_solicitud")
);

-- AddForeignKey
ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
