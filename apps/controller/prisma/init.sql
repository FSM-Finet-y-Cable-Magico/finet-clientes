-- ─────────────────────────────────────────────────────────────────────────────
-- Esquema completo del Portal Clientes (Grupo 2), desde cero.
--
-- ESTE ARCHIVO ES GENERADO, NO SE EDITA A MANO. Nuestra fuente de verdad es
-- `prisma/schema.prisma`, y el esquema de la base se versiona con migraciones de
-- Prisma (`prisma/migrations/`), no con un init.sql. Este archivo existe para
-- poder comparar esquemas con los otros grupos, que sí usan init.sql.
--
-- Para regenerarlo:
--   pnpm exec prisma migrate diff --from-empty --to-schema prisma/schema.prisma --script > prisma/init.sql
--   (y volver a pegar esta cabecera)
--
-- Comprobado el 2026-09-28: aplicado sobre una base vacía produce un esquema
-- idéntico al de la base de desarrollo, salvo `_prisma_migrations`, que es la
-- tabla de control interna de Prisma y no forma parte del modelo.
--
-- Contenido: 55 tablas, 98 claves foráneas, 16 índices. Incluye el dominio
-- completo de la base compartida, no solo las tablas que usa el Portal.
--
-- OJO al comparar: nuestro historial de migraciones y el que está aplicado en la
-- base compartida de Railway no tienen ancestro común (ver
-- docs/2026-09-12-cambio-db-solicitud-contrasena-wifi.md). Este archivo dice qué
-- espera nuestro código, no necesariamente qué hay hoy en Railway.
-- ─────────────────────────────────────────────────────────────────────────────

-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateTable
CREATE TABLE "baja_equipo" (
    "id_baja" SERIAL NOT NULL,
    "id_unidad" INTEGER,
    "id_usuario" INTEGER,
    "motivo_baja" TEXT NOT NULL,
    "tipo_baja" VARCHAR(20),
    "donacion_destinatario" VARCHAR(150),
    "fecha_baja" DATE,

    CONSTRAINT "baja_equipo_pkey" PRIMARY KEY ("id_baja")
);

-- CreateTable
CREATE TABLE "bodega" (
    "id_bodega" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "nombre" VARCHAR(60) NOT NULL,
    "direccion" VARCHAR(200),
    "activa" BOOLEAN DEFAULT true,

    CONSTRAINT "bodega_pkey" PRIMARY KEY ("id_bodega")
);

-- CreateTable
CREATE TABLE "caja_nap" (
    "id_caja_nap" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "id_mufa" INTEGER,
    "identificador_unico" VARCHAR(50),
    "numero_poste" VARCHAR(30),
    "zona" VARCHAR(80),
    "capacidad_puertos" SMALLINT,
    "latitud" DECIMAL(9,6),
    "longitud" DECIMAL(9,6),

    CONSTRAINT "caja_nap_pkey" PRIMARY KEY ("id_caja_nap")
);

-- CreateTable
CREATE TABLE "canal_whatsapp" (
    "id_canal" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "numero_telefono" VARCHAR(20),
    "nombre_canal" VARCHAR(80),
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "canal_whatsapp_pkey" PRIMARY KEY ("id_canal")
);

-- CreateTable
CREATE TABLE "categoria_falla" (
    "id_categoria" SERIAL NOT NULL,
    "nombre" VARCHAR(80) NOT NULL,
    "sla_horas" SMALLINT,

    CONSTRAINT "categoria_falla_pkey" PRIMARY KEY ("id_categoria")
);

-- CreateTable
CREATE TABLE "cliente" (
    "id_cliente" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "rut" VARCHAR(12),
    "nombre_completo" VARCHAR(120) NOT NULL,
    "email" VARCHAR(120),
    "telefono" VARCHAR(20),
    "password_portal_hash" VARCHAR(72),
    "estado" VARCHAR(20) NOT NULL,
    "es_conflictivo" BOOLEAN DEFAULT false,
    "importado_masivo" BOOLEAN DEFAULT false,
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "obs_conflictivo" TEXT,

    CONSTRAINT "cliente_pkey" PRIMARY KEY ("id_cliente")
);

-- CreateTable
CREATE TABLE "configuracion_seo" (
    "id_seo" SERIAL NOT NULL,
    "id_empresa" INTEGER NOT NULL,
    "seccion_url" VARCHAR(200) NOT NULL,
    "meta_titulo" VARCHAR(70),
    "meta_descripcion" VARCHAR(160),
    "og_tags" JSONB,
    "fecha_actualizacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "configuracion_seo_pkey" PRIMARY KEY ("id_seo")
);

-- CreateTable
CREATE TABLE "consentimiento_cookies" (
    "id_consentimiento" BIGSERIAL NOT NULL,
    "id_cliente" INTEGER,
    "ip_anonimizada" VARCHAR(45),
    "version_documento" VARCHAR(20),
    "fecha_aceptacion" TIMESTAMP(6),
    "acepto" BOOLEAN NOT NULL,

    CONSTRAINT "consentimiento_cookies_pkey" PRIMARY KEY ("id_consentimiento")
);

-- CreateTable
CREATE TABLE "contrato" (
    "id_contrato" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "id_plan" INTEGER,
    "id_empresa" INTEGER,
    "fecha_inicio" DATE NOT NULL,
    "dia_vencimiento" SMALLINT NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "fecha_suspension" DATE,

    CONSTRAINT "contrato_pkey" PRIMARY KEY ("id_contrato")
);

-- CreateTable
CREATE TABLE "conversacion_bot" (
    "id_conversacion" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "id_canal_wa" INTEGER,
    "plataforma" VARCHAR(20),
    "fecha_inicio" TIMESTAMP(6),
    "fecha_fin" TIMESTAMP(6),
    "derivada_humano" BOOLEAN DEFAULT false,

    CONSTRAINT "conversacion_bot_pkey" PRIMARY KEY ("id_conversacion")
);

-- CreateTable
CREATE TABLE "cotizacion" (
    "id_cotizacion" SERIAL NOT NULL,
    "id_prospecto" INTEGER,
    "id_plan" INTEGER,
    "pdf_url" TEXT,
    "fecha_envio" TIMESTAMP(6),
    "factibilidad_verificada" BOOLEAN DEFAULT false,

    CONSTRAINT "cotizacion_pkey" PRIMARY KEY ("id_cotizacion")
);

-- CreateTable
CREATE TABLE "credenciales_tvip" (
    "id_credencial" SERIAL NOT NULL,
    "id_contrato" INTEGER,
    "usuario_tvip" VARCHAR(80),
    "password_tvip_hash" VARCHAR(72),
    "fecha_generacion" TIMESTAMP(6),

    CONSTRAINT "credenciales_tvip_pkey" PRIMARY KEY ("id_credencial")
);

-- CreateTable
CREATE TABLE "detalle_orden_ingreso" (
    "id_detalle" SERIAL NOT NULL,
    "id_orden" INTEGER,
    "id_tipo_equipo" INTEGER,
    "cantidad_solicitada" INTEGER NOT NULL,
    "cantidad_recibida" INTEGER DEFAULT 0,

    CONSTRAINT "detalle_orden_ingreso_pkey" PRIMARY KEY ("id_detalle")
);

-- CreateTable
CREATE TABLE "direccion_servicio" (
    "id_direccion" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "direccion_completa" VARCHAR(200) NOT NULL,
    "comuna" VARCHAR(80) NOT NULL,
    "ciudad" VARCHAR(80),
    "es_principal" BOOLEAN DEFAULT true,

    CONSTRAINT "direccion_servicio_pkey" PRIMARY KEY ("id_direccion")
);

-- CreateTable
CREATE TABLE "empresa" (
    "id_empresa" SERIAL NOT NULL,
    "nombre" VARCHAR(100) NOT NULL,
    "rut_empresa" VARCHAR(12),
    "esquema_db" VARCHAR(50),

    CONSTRAINT "empresa_pkey" PRIMARY KEY ("id_empresa")
);

-- CreateTable
CREATE TABLE "evidencia_foto" (
    "id_foto" SERIAL NOT NULL,
    "id_ot" INTEGER,
    "url_cloudinary" TEXT NOT NULL,
    "formato" VARCHAR(5),
    "tamano_kb" INTEGER,
    "fecha_subida" TIMESTAMP(6),

    CONSTRAINT "evidencia_foto_pkey" PRIMARY KEY ("id_foto")
);

-- CreateTable
CREATE TABLE "factura" (
    "id_factura" SERIAL NOT NULL,
    "id_contrato" INTEGER,
    "periodo_mes" SMALLINT NOT NULL,
    "periodo_anio" SMALLINT NOT NULL,
    "monto" DECIMAL(10,2),
    "fecha_emision" DATE,
    "fecha_limite_pago" DATE NOT NULL,
    "estado" VARCHAR(20) NOT NULL,

    CONSTRAINT "factura_pkey" PRIMARY KEY ("id_factura")
);

-- CreateTable
CREATE TABLE "historial_conexion_ont" (
    "id_historial_ont" BIGSERIAL NOT NULL,
    "id_unidad" INTEGER,
    "evento" VARCHAR(15),
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_conexion_ont_pkey" PRIMARY KEY ("id_historial_ont")
);

-- CreateTable
CREATE TABLE "historial_estado_equipo" (
    "id_historial" BIGSERIAL NOT NULL,
    "id_unidad" INTEGER,
    "id_usuario" INTEGER,
    "estado_anterior" VARCHAR(30),
    "estado_nuevo" VARCHAR(30),
    "motivo" TEXT,
    "fecha_hora" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "historial_estado_equipo_pkey" PRIMARY KEY ("id_historial")
);

-- CreateTable
CREATE TABLE "historial_ot" (
    "id_historial_ot" BIGSERIAL NOT NULL,
    "id_ot" INTEGER,
    "id_usuario" INTEGER,
    "estado_anterior" VARCHAR(25),
    "estado_nuevo" VARCHAR(25),
    "observaciones" TEXT,
    "fecha_hora" TIMESTAMP(6),

    CONSTRAINT "historial_ot_pkey" PRIMARY KEY ("id_historial_ot")
);

-- CreateTable
CREATE TABLE "intento_fallido" (
    "id_intento" BIGSERIAL NOT NULL,
    "id_empresa" INTEGER,
    "ip_address" INET NOT NULL,
    "rut_intentado" VARCHAR(12),
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "bloqueado_hasta" TIMESTAMP(6),

    CONSTRAINT "intento_fallido_pkey" PRIMARY KEY ("id_intento")
);

-- CreateTable
CREATE TABLE "lista_negra" (
    "id_vetado" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "rut_vetado" VARCHAR(12) NOT NULL,
    "direccion_vetada" TEXT,
    "motivo" TEXT NOT NULL,
    "fecha_registro" DATE,
    "id_usuario_registro" INTEGER,

    CONSTRAINT "lista_negra_pkey" PRIMARY KEY ("id_vetado")
);

-- CreateTable
CREATE TABLE "llamada_cortes" (
    "id_llamada" SERIAL NOT NULL,
    "id_ot" INTEGER,
    "resultado" VARCHAR(15) NOT NULL,
    "observaciones" TEXT,
    "fecha_llamada" TIMESTAMP(6),

    CONSTRAINT "llamada_cortes_pkey" PRIMARY KEY ("id_llamada")
);

-- CreateTable
CREATE TABLE "log_auditoria" (
    "id_log" BIGSERIAL NOT NULL,
    "id_usuario" INTEGER,
    "accion" VARCHAR(100) NOT NULL,
    "entidad_afectada" VARCHAR(80),
    "id_entidad_afectada" INTEGER,
    "valor_anterior" JSONB,
    "valor_nuevo" JSONB,
    "ip_origen" INET,
    "fecha_hora" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "log_auditoria_pkey" PRIMARY KEY ("id_log")
);

-- CreateTable
CREATE TABLE "log_notificacion" (
    "id_notificacion" BIGSERIAL NOT NULL,
    "id_cliente" INTEGER,
    "id_plantilla" INTEGER,
    "canal" VARCHAR(20),
    "fecha_envio" TIMESTAMP(6),
    "estado_envio" VARCHAR(20),

    CONSTRAINT "log_notificacion_pkey" PRIMARY KEY ("id_notificacion")
);

-- CreateTable
CREATE TABLE "mensaje_bot" (
    "id_mensaje" BIGSERIAL NOT NULL,
    "id_conversacion" INTEGER,
    "rol" VARCHAR(15),
    "contenido" TEXT,
    "timestamp" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "datos_sensibles" BOOLEAN,

    CONSTRAINT "mensaje_bot_pkey" PRIMARY KEY ("id_mensaje")
);

-- CreateTable
CREATE TABLE "mensaje_whatsapp" (
    "id_mensaje_wa" BIGSERIAL NOT NULL,
    "id_canal" INTEGER,
    "id_cliente" INTEGER,
    "id_plantilla_wa" INTEGER,
    "contenido" TEXT,
    "timestamp" TIMESTAMP(6),
    "origen" VARCHAR(10),
    "estado" VARCHAR(15),

    CONSTRAINT "mensaje_whatsapp_pkey" PRIMARY KEY ("id_mensaje_wa")
);

-- CreateTable
CREATE TABLE "monitoreo_ont" (
    "id_monitoreo" BIGSERIAL NOT NULL,
    "id_unidad" INTEGER,
    "id_cliente" INTEGER,
    "id_caja_nap" INTEGER,
    "potencia_actual_dbm" DECIMAL(5,2),
    "timestamp_medicion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "estado_conexion" VARCHAR(15),

    CONSTRAINT "monitoreo_ont_pkey" PRIMARY KEY ("id_monitoreo")
);

-- CreateTable
CREATE TABLE "movimiento_inventario" (
    "id_movimiento" BIGSERIAL NOT NULL,
    "id_tipo_equipo" INTEGER,
    "id_unidad" INTEGER,
    "id_empresa_origen" INTEGER,
    "id_empresa_destino" INTEGER,
    "id_bodega_origen" INTEGER,
    "id_bodega_destino" INTEGER,
    "id_usuario" INTEGER,
    "tipo_movimiento" VARCHAR(30),
    "cantidad" DECIMAL(10,2) DEFAULT 1,
    "fecha" TIMESTAMP(6),
    "referencia_id" INTEGER,

    CONSTRAINT "movimiento_inventario_pkey" PRIMARY KEY ("id_movimiento")
);

-- CreateTable
CREATE TABLE "mufa" (
    "id_mufa" SERIAL NOT NULL,
    "id_tarjeta_pon" INTEGER,
    "identificador" VARCHAR(50),
    "ubicacion" VARCHAR(200),

    CONSTRAINT "mufa_pkey" PRIMARY KEY ("id_mufa")
);

-- CreateTable
CREATE TABLE "olt" (
    "id_olt" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "nombre" VARCHAR(80),
    "ubicacion" VARCHAR(200),
    "ip_gestion" INET,

    CONSTRAINT "olt_pkey" PRIMARY KEY ("id_olt")
);

-- CreateTable
CREATE TABLE "orden_ingreso" (
    "id_orden" SERIAL NOT NULL,
    "id_proveedor" INTEGER,
    "id_bodega" INTEGER,
    "id_empresa" INTEGER,
    "id_usuario_registro" INTEGER,
    "fecha_creacion" DATE,
    "fecha_recepcion" DATE,
    "estado" VARCHAR(25),
    "factura_proveedor" VARCHAR(50),

    CONSTRAINT "orden_ingreso_pkey" PRIMARY KEY ("id_orden")
);

-- CreateTable
CREATE TABLE "orden_trabajo" (
    "id_ot" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "id_cliente" INTEGER,
    "id_tecnico" INTEGER,
    "id_tecnico_externo" INTEGER,
    "id_direccion" INTEGER,
    "id_ticket" INTEGER,
    "tipo_ot" VARCHAR(20) NOT NULL,
    "prioridad" VARCHAR(10) NOT NULL,
    "estado" VARCHAR(25) NOT NULL,
    "fecha_creacion" TIMESTAMP(6),
    "fecha_programada" DATE,
    "fecha_completada" TIMESTAMP(6),
    "potencia_optica_dbm" DECIMAL(5,2),
    "observaciones" TEXT,
    "resuelto_remotamente" BOOLEAN DEFAULT false,

    CONSTRAINT "orden_trabajo_pkey" PRIMARY KEY ("id_ot")
);

-- CreateTable
CREATE TABLE "pago" (
    "id_pago" SERIAL NOT NULL,
    "id_factura" INTEGER,
    "id_cliente" INTEGER,
    "monto" DECIMAL(10,2) NOT NULL,
    "fecha_pago" TIMESTAMP(6) NOT NULL,
    "codigo_transaccion" VARCHAR(100),
    "pasarela" VARCHAR(30) NOT NULL,
    "token_transaccional" VARCHAR(200),
    "comprobante_pdf_url" TEXT,

    CONSTRAINT "pago_pkey" PRIMARY KEY ("id_pago")
);

-- CreateTable
CREATE TABLE "plan" (
    "id_plan" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "nombre_comercial" VARCHAR(100) NOT NULL,
    "tipo_plan" VARCHAR(20) NOT NULL,
    "tipo_cliente" VARCHAR(20) NOT NULL,
    "velocidad_mbps" INTEGER,
    "precio_mensual" DECIMAL(10,2) NOT NULL,
    "descripcion" TEXT,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "plan_pkey" PRIMARY KEY ("id_plan")
);

-- CreateTable
CREATE TABLE "plantilla_notificacion" (
    "id_plantilla" SERIAL NOT NULL,
    "tipo_evento" VARCHAR(60),
    "canal" VARCHAR(20) NOT NULL,
    "contenido_texto" TEXT,
    "activa" BOOLEAN DEFAULT true,

    CONSTRAINT "plantilla_notificacion_pkey" PRIMARY KEY ("id_plantilla")
);

-- CreateTable
CREATE TABLE "plantilla_whatsapp" (
    "id_plantilla_wa" SERIAL NOT NULL,
    "id_canal" INTEGER,
    "nombre_plantilla" VARCHAR(80),
    "contenido" TEXT,
    "tipo_uso" VARCHAR(40),

    CONSTRAINT "plantilla_whatsapp_pkey" PRIMARY KEY ("id_plantilla_wa")
);

-- CreateTable
CREATE TABLE "prestamo_externo" (
    "id_prestamo" SERIAL NOT NULL,
    "id_unidad" INTEGER,
    "id_empresa_prestamista" INTEGER,
    "destinatario" VARCHAR(100),
    "motivo" TEXT,
    "fecha_salida" DATE,
    "fecha_retorno_esperada" DATE,
    "fecha_retorno_real" DATE,
    "estado" VARCHAR(20),
    "condicion_retorno" TEXT,

    CONSTRAINT "prestamo_externo_pkey" PRIMARY KEY ("id_prestamo")
);

-- CreateTable
CREATE TABLE "prospecto" (
    "id_prospecto" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "id_usuario_comercial" INTEGER,
    "id_cliente" INTEGER,
    "rut" VARCHAR(12),
    "nombre_completo" VARCHAR(120),
    "email" VARCHAR(120),
    "telefono" VARCHAR(20),
    "direccion" VARCHAR(200),
    "estado_pipeline" VARCHAR(30),
    "motivo_perdida" VARCHAR(30),
    "tiempo_conversion_dias" INTEGER,
    "fecha_creacion" TIMESTAMP(6),
    "fecha_conversion" DATE,

    CONSTRAINT "prospecto_pkey" PRIMARY KEY ("id_prospecto")
);

-- CreateTable
CREATE TABLE "proveedor" (
    "id_proveedor" SERIAL NOT NULL,
    "nombre_comercial" VARCHAR(100) NOT NULL,
    "rut_proveedor" VARCHAR(12),
    "contacto" VARCHAR(80),
    "telefono" VARCHAR(20),
    "email" VARCHAR(120),

    CONSTRAINT "proveedor_pkey" PRIMARY KEY ("id_proveedor")
);

-- CreateTable
CREATE TABLE "puerto_nap" (
    "id_puerto" SERIAL NOT NULL,
    "id_caja_nap" INTEGER,
    "numero_puerto" SMALLINT,
    "estado" VARCHAR(10),
    "id_cliente_asociado" INTEGER,

    CONSTRAINT "puerto_nap_pkey" PRIMARY KEY ("id_puerto")
);

-- CreateTable
CREATE TABLE "punto_cobertura" (
    "id_punto" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "latitud" DECIMAL(9,6) NOT NULL,
    "longitud" DECIMAL(9,6) NOT NULL,
    "densidad_cobertura" DECIMAL(5,2),
    "tipo_cobertura" VARCHAR(20),

    CONSTRAINT "punto_cobertura_pkey" PRIMARY KEY ("id_punto")
);

-- CreateTable
CREATE TABLE "rol" (
    "id_rol" SERIAL NOT NULL,
    "nombre_rol" VARCHAR(50) NOT NULL,
    "descripcion" TEXT,

    CONSTRAINT "rol_pkey" PRIMARY KEY ("id_rol")
);

-- CreateTable
CREATE TABLE "sesion_portal" (
    "id_sesion" BIGSERIAL NOT NULL,
    "id_cliente" INTEGER,
    "token" TEXT NOT NULL,
    "fecha_inicio" TIMESTAMP(6),
    "fecha_expiracion" TIMESTAMP(6),
    "ip_origen" INET,

    CONSTRAINT "sesion_portal_pkey" PRIMARY KEY ("id_sesion")
);

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

-- CreateTable
CREATE TABLE "stock_consumible" (
    "id_stock" SERIAL NOT NULL,
    "id_tipo_equipo" INTEGER,
    "id_bodega" INTEGER,
    "cantidad_disponible" DECIMAL(10,2) NOT NULL,
    "umbral_minimo" DECIMAL(10,2),

    CONSTRAINT "stock_consumible_pkey" PRIMARY KEY ("id_stock")
);

-- CreateTable
CREATE TABLE "tarjeta_pon" (
    "id_tarjeta" SERIAL NOT NULL,
    "id_olt" INTEGER,
    "numero_tarjeta" SMALLINT,
    "total_puertos" SMALLINT,

    CONSTRAINT "tarjeta_pon_pkey" PRIMARY KEY ("id_tarjeta")
);

-- CreateTable
CREATE TABLE "tecnico_externo" (
    "id_tecnico_ext" SERIAL NOT NULL,
    "nombre_completo" VARCHAR(120) NOT NULL,
    "empresa" VARCHAR(100),
    "telefono" VARCHAR(20),
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "tecnico_externo_pkey" PRIMARY KEY ("id_tecnico_ext")
);

-- CreateTable
CREATE TABLE "ticket" (
    "id_ticket" SERIAL NOT NULL,
    "id_cliente" INTEGER,
    "id_empresa" INTEGER,
    "id_usuario_asignado" INTEGER,
    "id_categoria" INTEGER NOT NULL,
    "id_conversacion_bot" INTEGER,
    "codigo_seguimiento" VARCHAR(20),
    "prioridad" VARCHAR(10) NOT NULL,
    "estado" VARCHAR(20) NOT NULL,
    "descripcion" TEXT,
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "fecha_cierre" TIMESTAMP(6),
    "origen" VARCHAR(20),
    "resuelto_remotamente" BOOLEAN DEFAULT false,

    CONSTRAINT "ticket_pkey" PRIMARY KEY ("id_ticket")
);

-- CreateTable
CREATE TABLE "tipo_equipo" (
    "id_tipo_equipo" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "nombre" VARCHAR(100) NOT NULL,
    "categoria" VARCHAR(40),
    "requiere_serie_individual" BOOLEAN,
    "ficha_tecnica_pdf_url" TEXT,
    "activo" BOOLEAN DEFAULT true,

    CONSTRAINT "tipo_equipo_pkey" PRIMARY KEY ("id_tipo_equipo")
);

-- CreateTable
CREATE TABLE "transferencia_equipo" (
    "id_transferencia" SERIAL NOT NULL,
    "id_empresa_origen" INTEGER,
    "id_empresa_destino" INTEGER,
    "id_usuario_registro" INTEGER,
    "fecha_transferencia" DATE,
    "observaciones" TEXT,

    CONSTRAINT "transferencia_equipo_pkey" PRIMARY KEY ("id_transferencia")
);

-- CreateTable
CREATE TABLE "unidad_equipo" (
    "id_unidad" SERIAL NOT NULL,
    "id_tipo_equipo" INTEGER,
    "id_empresa" INTEGER,
    "numero_serie" VARCHAR(80) NOT NULL,
    "modelo" VARCHAR(80),
    "estado" VARCHAR(30) NOT NULL,
    "fecha_adquisicion" DATE,
    "fecha_venc_garantia" DATE,
    "diagnostico_tecnico" TEXT,
    "id_cliente_instalado" INTEGER,
    "id_bodega_actual" INTEGER,
    "numero_poste" VARCHAR(30),
    "id_caja_nap" INTEGER,

    CONSTRAINT "unidad_equipo_pkey" PRIMARY KEY ("id_unidad")
);

-- CreateTable
CREATE TABLE "uso_material_ot" (
    "id_uso" SERIAL NOT NULL,
    "id_ot" INTEGER,
    "id_tipo_equipo" INTEGER,
    "id_unidad" INTEGER,
    "cantidad" DECIMAL(10,2) NOT NULL,

    CONSTRAINT "uso_material_ot_pkey" PRIMARY KEY ("id_uso")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "id_empresa" INTEGER,
    "nombre_completo" VARCHAR(80) NOT NULL,
    "nombre_usuario" VARCHAR(50),
    "email" VARCHAR(120),
    "password_hash" VARCHAR(72) NOT NULL,
    "activo" BOOLEAN DEFAULT true,
    "fecha_creacion" TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
    "es_password_temporal" BOOLEAN DEFAULT true,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateTable
CREATE TABLE "usuario_rol" (
    "id_usuario_rol" SERIAL NOT NULL,
    "id_usuario" INTEGER,
    "id_rol" INTEGER NOT NULL,
    "fecha_asignacion" DATE DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_rol_pkey" PRIMARY KEY ("id_usuario_rol")
);

-- CreateIndex
CREATE UNIQUE INDEX "caja_nap_identificador_unico_key" ON "caja_nap"("identificador_unico");

-- CreateIndex
CREATE UNIQUE INDEX "canal_whatsapp_numero_telefono_key" ON "canal_whatsapp"("numero_telefono");

-- CreateIndex
CREATE UNIQUE INDEX "cliente_rut_key" ON "cliente"("rut");

-- CreateIndex
CREATE UNIQUE INDEX "configuracion_seo_id_empresa_seccion_url_key" ON "configuracion_seo"("id_empresa", "seccion_url");

-- CreateIndex
CREATE UNIQUE INDEX "credenciales_tvip_id_contrato_key" ON "credenciales_tvip"("id_contrato");

-- CreateIndex
CREATE UNIQUE INDEX "empresa_rut_empresa_key" ON "empresa"("rut_empresa");

-- CreateIndex
CREATE UNIQUE INDEX "llamada_cortes_id_ot_key" ON "llamada_cortes"("id_ot");

-- CreateIndex
CREATE UNIQUE INDEX "orden_trabajo_id_ticket_key" ON "orden_trabajo"("id_ticket");

-- CreateIndex
CREATE UNIQUE INDEX "pago_codigo_transaccion_key" ON "pago"("codigo_transaccion");

-- CreateIndex
CREATE UNIQUE INDEX "prospecto_id_cliente_key" ON "prospecto"("id_cliente");

-- CreateIndex
CREATE UNIQUE INDEX "rol_nombre_rol_key" ON "rol"("nombre_rol");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_id_conversacion_bot_key" ON "ticket"("id_conversacion_bot");

-- CreateIndex
CREATE UNIQUE INDEX "ticket_codigo_seguimiento_key" ON "ticket"("codigo_seguimiento");

-- CreateIndex
CREATE UNIQUE INDEX "unidad_equipo_numero_serie_key" ON "unidad_equipo"("numero_serie");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_nombre_usuario_key" ON "usuario"("nombre_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "baja_equipo" ADD CONSTRAINT "fk_baja_equipo_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "baja_equipo" ADD CONSTRAINT "fk_baja_equipo_id_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "bodega" ADD CONSTRAINT "fk_bodega_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "caja_nap" ADD CONSTRAINT "fk_caja_nap_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "caja_nap" ADD CONSTRAINT "fk_caja_nap_id_mufa" FOREIGN KEY ("id_mufa") REFERENCES "mufa"("id_mufa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "canal_whatsapp" ADD CONSTRAINT "fk_canal_whatsapp_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cliente" ADD CONSTRAINT "fk_cliente_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "configuracion_seo" ADD CONSTRAINT "fk_configuracion_seo_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "consentimiento_cookies" ADD CONSTRAINT "fk_consentimiento_cookies_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "fk_contrato_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "fk_contrato_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "contrato" ADD CONSTRAINT "fk_contrato_id_plan" FOREIGN KEY ("id_plan") REFERENCES "plan"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversacion_bot" ADD CONSTRAINT "fk_conversacion_bot_id_canal_wa" FOREIGN KEY ("id_canal_wa") REFERENCES "canal_whatsapp"("id_canal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "conversacion_bot" ADD CONSTRAINT "fk_conversacion_bot_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cotizacion" ADD CONSTRAINT "fk_cotizacion_id_plan" FOREIGN KEY ("id_plan") REFERENCES "plan"("id_plan") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "cotizacion" ADD CONSTRAINT "fk_cotizacion_id_prospecto" FOREIGN KEY ("id_prospecto") REFERENCES "prospecto"("id_prospecto") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "credenciales_tvip" ADD CONSTRAINT "fk_credenciales_tvip_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_orden_ingreso" ADD CONSTRAINT "fk_detalle_orden_ingreso_id_orden" FOREIGN KEY ("id_orden") REFERENCES "orden_ingreso"("id_orden") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "detalle_orden_ingreso" ADD CONSTRAINT "fk_detalle_orden_ingreso_id_tipo_equipo" FOREIGN KEY ("id_tipo_equipo") REFERENCES "tipo_equipo"("id_tipo_equipo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "direccion_servicio" ADD CONSTRAINT "fk_direccion_servicio_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "evidencia_foto" ADD CONSTRAINT "fk_evidencia_foto_id_ot" FOREIGN KEY ("id_ot") REFERENCES "orden_trabajo"("id_ot") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "factura" ADD CONSTRAINT "fk_factura_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_conexion_ont" ADD CONSTRAINT "fk_historial_conexion_ont_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_estado_equipo" ADD CONSTRAINT "fk_historial_estado_equipo_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_estado_equipo" ADD CONSTRAINT "fk_historial_estado_equipo_id_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_ot" ADD CONSTRAINT "fk_historial_ot_id_ot" FOREIGN KEY ("id_ot") REFERENCES "orden_trabajo"("id_ot") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "historial_ot" ADD CONSTRAINT "fk_historial_ot_id_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "intento_fallido" ADD CONSTRAINT "fk_intento_fallido_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lista_negra" ADD CONSTRAINT "fk_lista_negra_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "lista_negra" ADD CONSTRAINT "fk_lista_negra_id_usuario_registro" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "llamada_cortes" ADD CONSTRAINT "fk_llamada_cortes_id_ot" FOREIGN KEY ("id_ot") REFERENCES "orden_trabajo"("id_ot") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "log_auditoria" ADD CONSTRAINT "fk_log_auditoria_id_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "log_notificacion" ADD CONSTRAINT "fk_log_notificacion_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "log_notificacion" ADD CONSTRAINT "fk_log_notificacion_id_plantilla" FOREIGN KEY ("id_plantilla") REFERENCES "plantilla_notificacion"("id_plantilla") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mensaje_bot" ADD CONSTRAINT "fk_mensaje_bot_id_conversacion" FOREIGN KEY ("id_conversacion") REFERENCES "conversacion_bot"("id_conversacion") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mensaje_whatsapp" ADD CONSTRAINT "fk_mensaje_whatsapp_id_canal" FOREIGN KEY ("id_canal") REFERENCES "canal_whatsapp"("id_canal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mensaje_whatsapp" ADD CONSTRAINT "fk_mensaje_whatsapp_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mensaje_whatsapp" ADD CONSTRAINT "fk_mensaje_whatsapp_id_plantilla_wa" FOREIGN KEY ("id_plantilla_wa") REFERENCES "plantilla_whatsapp"("id_plantilla_wa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monitoreo_ont" ADD CONSTRAINT "fk_monitoreo_ont_id_caja_nap" FOREIGN KEY ("id_caja_nap") REFERENCES "caja_nap"("id_caja_nap") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monitoreo_ont" ADD CONSTRAINT "fk_monitoreo_ont_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "monitoreo_ont" ADD CONSTRAINT "fk_monitoreo_ont_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_bodega_destino" FOREIGN KEY ("id_bodega_destino") REFERENCES "bodega"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_bodega_origen" FOREIGN KEY ("id_bodega_origen") REFERENCES "bodega"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_empresa_destino" FOREIGN KEY ("id_empresa_destino") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_empresa_origen" FOREIGN KEY ("id_empresa_origen") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_tipo_equipo" FOREIGN KEY ("id_tipo_equipo") REFERENCES "tipo_equipo"("id_tipo_equipo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "movimiento_inventario" ADD CONSTRAINT "fk_movimiento_inventario_id_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "mufa" ADD CONSTRAINT "fk_mufa_id_tarjeta_pon" FOREIGN KEY ("id_tarjeta_pon") REFERENCES "tarjeta_pon"("id_tarjeta") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "olt" ADD CONSTRAINT "fk_olt_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_ingreso" ADD CONSTRAINT "fk_orden_ingreso_id_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodega"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_ingreso" ADD CONSTRAINT "fk_orden_ingreso_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_ingreso" ADD CONSTRAINT "fk_orden_ingreso_id_proveedor" FOREIGN KEY ("id_proveedor") REFERENCES "proveedor"("id_proveedor") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_ingreso" ADD CONSTRAINT "fk_orden_ingreso_id_usuario_registro" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_trabajo_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_trabajo_id_direccion" FOREIGN KEY ("id_direccion") REFERENCES "direccion_servicio"("id_direccion") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_trabajo_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_trabajo_id_tecnico" FOREIGN KEY ("id_tecnico") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_trabajo_id_tecnico_externo" FOREIGN KEY ("id_tecnico_externo") REFERENCES "tecnico_externo"("id_tecnico_ext") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "orden_trabajo" ADD CONSTRAINT "fk_orden_trabajo_id_ticket" FOREIGN KEY ("id_ticket") REFERENCES "ticket"("id_ticket") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "fk_pago_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "pago" ADD CONSTRAINT "fk_pago_id_factura" FOREIGN KEY ("id_factura") REFERENCES "factura"("id_factura") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plan" ADD CONSTRAINT "fk_plan_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "plantilla_whatsapp" ADD CONSTRAINT "fk_plantilla_whatsapp_id_canal" FOREIGN KEY ("id_canal") REFERENCES "canal_whatsapp"("id_canal") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prestamo_externo" ADD CONSTRAINT "fk_prestamo_externo_id_empresa_prestamista" FOREIGN KEY ("id_empresa_prestamista") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prestamo_externo" ADD CONSTRAINT "fk_prestamo_externo_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospecto" ADD CONSTRAINT "fk_prospecto_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospecto" ADD CONSTRAINT "fk_prospecto_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "prospecto" ADD CONSTRAINT "fk_prospecto_id_usuario_comercial" FOREIGN KEY ("id_usuario_comercial") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "puerto_nap" ADD CONSTRAINT "fk_puerto_nap_id_caja_nap" FOREIGN KEY ("id_caja_nap") REFERENCES "caja_nap"("id_caja_nap") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "puerto_nap" ADD CONSTRAINT "fk_puerto_nap_id_cliente_asociado" FOREIGN KEY ("id_cliente_asociado") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "punto_cobertura" ADD CONSTRAINT "fk_punto_cobertura_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "sesion_portal" ADD CONSTRAINT "fk_sesion_portal_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_consumible" ADD CONSTRAINT "fk_stock_consumible_id_bodega" FOREIGN KEY ("id_bodega") REFERENCES "bodega"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "stock_consumible" ADD CONSTRAINT "fk_stock_consumible_id_tipo_equipo" FOREIGN KEY ("id_tipo_equipo") REFERENCES "tipo_equipo"("id_tipo_equipo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tarjeta_pon" ADD CONSTRAINT "fk_tarjeta_pon_id_olt" FOREIGN KEY ("id_olt") REFERENCES "olt"("id_olt") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "fk_ticket_id_categoria" FOREIGN KEY ("id_categoria") REFERENCES "categoria_falla"("id_categoria") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "fk_ticket_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "fk_ticket_id_conversacion_bot" FOREIGN KEY ("id_conversacion_bot") REFERENCES "conversacion_bot"("id_conversacion") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "fk_ticket_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "ticket" ADD CONSTRAINT "fk_ticket_id_usuario_asignado" FOREIGN KEY ("id_usuario_asignado") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "tipo_equipo" ADD CONSTRAINT "fk_tipo_equipo_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transferencia_equipo" ADD CONSTRAINT "fk_transferencia_equipo_id_empresa_destino" FOREIGN KEY ("id_empresa_destino") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transferencia_equipo" ADD CONSTRAINT "fk_transferencia_equipo_id_empresa_origen" FOREIGN KEY ("id_empresa_origen") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "transferencia_equipo" ADD CONSTRAINT "fk_transferencia_equipo_id_usuario_registro" FOREIGN KEY ("id_usuario_registro") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidad_equipo" ADD CONSTRAINT "fk_unidad_equipo_id_bodega_actual" FOREIGN KEY ("id_bodega_actual") REFERENCES "bodega"("id_bodega") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidad_equipo" ADD CONSTRAINT "fk_unidad_equipo_id_caja_nap" FOREIGN KEY ("id_caja_nap") REFERENCES "caja_nap"("id_caja_nap") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidad_equipo" ADD CONSTRAINT "fk_unidad_equipo_id_cliente_instalado" FOREIGN KEY ("id_cliente_instalado") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidad_equipo" ADD CONSTRAINT "fk_unidad_equipo_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "unidad_equipo" ADD CONSTRAINT "fk_unidad_equipo_id_tipo_equipo" FOREIGN KEY ("id_tipo_equipo") REFERENCES "tipo_equipo"("id_tipo_equipo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "uso_material_ot" ADD CONSTRAINT "fk_uso_material_ot_id_ot" FOREIGN KEY ("id_ot") REFERENCES "orden_trabajo"("id_ot") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "uso_material_ot" ADD CONSTRAINT "fk_uso_material_ot_id_tipo_equipo" FOREIGN KEY ("id_tipo_equipo") REFERENCES "tipo_equipo"("id_tipo_equipo") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "uso_material_ot" ADD CONSTRAINT "fk_uso_material_ot_id_unidad" FOREIGN KEY ("id_unidad") REFERENCES "unidad_equipo"("id_unidad") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario" ADD CONSTRAINT "fk_usuario_id_empresa" FOREIGN KEY ("id_empresa") REFERENCES "empresa"("id_empresa") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "fk_usuario_rol_id_rol" FOREIGN KEY ("id_rol") REFERENCES "rol"("id_rol") ON DELETE NO ACTION ON UPDATE NO ACTION;

-- AddForeignKey
ALTER TABLE "usuario_rol" ADD CONSTRAINT "fk_usuario_rol_id_usuario" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE NO ACTION ON UPDATE NO ACTION;

