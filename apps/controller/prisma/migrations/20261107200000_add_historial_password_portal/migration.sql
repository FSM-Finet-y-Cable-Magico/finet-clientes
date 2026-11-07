-- CU-10 / RNF-08.2: el cliente no puede reutilizar ninguna de sus últimas 5
-- contraseñas del portal, "validado mediante comparación de hashes en el
-- backend".
--
-- Ni el modelo relacional ni el Documento 0 tenían dónde guardar las
-- contraseñas anteriores. Se descartó:
--   - ampliar cliente.password_portal_hash (VARCHAR(72), cabe un solo hash
--     bcrypt) para meter varios: también cambia el esquema y deja el historial
--     en una tabla que leen todos los grupos;
--   - guardarlos en log_auditoria.valor_anterior: la auditoría la leen otros
--     grupos y las pantallas de administración, y un hash de contraseña no
--     debe quedar expuesto ahí.
--
-- Solo guarda hashes bcrypt (nunca la contraseña), los escribe y los lee
-- únicamente el portal (G2). G8 quedó avisado (acuerdo v2.0, §13.1).

-- CreateTable
CREATE TABLE "historial_password_portal" (
    "id_historial" SERIAL NOT NULL,
    "id_cliente" INTEGER NOT NULL,
    "password_hash" VARCHAR(72) NOT NULL,
    "fecha" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_password_portal_pkey" PRIMARY KEY ("id_historial")
);

-- CreateIndex
CREATE INDEX "idx_historial_password_portal_cliente_fecha" ON "historial_password_portal"("id_cliente", "fecha" DESC);

-- AddForeignKey
ALTER TABLE "historial_password_portal" ADD CONSTRAINT "fk_historial_password_portal_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;
