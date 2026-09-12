# Cambio aplicado a la base compartida — `solicitud_contrasena_wifi`

**De:** Grupo 2 (Portal Clientes) · **Para:** Grupo 8 (CRM) · **Fecha:** 2026-09-12

Este documento deja registrados dos cambios que aplicamos hoy directo contra la
base Postgres compartida (`railway`, host `junction.proxy.rlwy.net`), para que
quede visible del lado de ustedes. No requiere ninguna acción de su parte salvo
la confirmación pedida al final.

## Contexto

Al implementar CU-31/32 (solicitud de cambio de clave WiFi desde el portal)
detectamos que la tabla `solicitud_contrasena_wifi` no existía en la base
compartida, aunque la migración que la crea ya estaba commiteada en nuestro
repo desde el 2026-09-10. El formulario del portal fallaba con
`relation "public.solicitud_contrasena_wifi" does not exist`.

Al revisar por qué, encontramos que **el historial de migraciones de Prisma
de nuestro lado y el que ustedes tienen aplicado en esa base no comparten
ningún ancestro en común** (`prisma migrate status` no encuentra una migración
base compartida). Nuestro lado ve 3 migraciones propias sin aplicar; la base
tiene 19 migraciones aplicadas con nombres de su dominio (OTs, alertas de
monitoreo, NAP, etc.) que no existen en nuestro repo. Es decir: los dos lados
evolucionan el mismo schema con historiales de migración completamente
distintos y no sincronizados entre sí.

Por eso **no corrimos `prisma migrate deploy`** (hubiera intentado recrear
tablas que ya existen del lado de ustedes) y en vez de eso aplicamos a mano,
de forma quirúrgica, solo el cambio que nos hacía falta.

## Cambio 1 — Tabla nueva `solicitud_contrasena_wifi`

Ejecutado directo contra la base compartida:

```sql
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

ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_cliente" FOREIGN KEY ("id_cliente") REFERENCES "cliente"("id_cliente") ON DELETE NO ACTION ON UPDATE NO ACTION;

ALTER TABLE "solicitud_contrasena_wifi" ADD CONSTRAINT "fk_solicitud_contrasena_wifi_id_contrato" FOREIGN KEY ("id_contrato") REFERENCES "contrato"("id_contrato") ON DELETE NO ACTION ON UPDATE NO ACTION;
```

Es aditivo: tabla nueva, dos FKs hacia `cliente` y `contrato` (ya existentes),
nada existente se modificó ni se borró. El detalle de qué guarda cada columna
y el contrato de cómo ustedes deben cerrarla (`estado`, cifrado de
`password_nueva_cifrada` con su llave privada, cuándo dejarla en `NULL`) está
documentado en el comentario de cabecera de la migración:
[`apps/controller/prisma/migrations/20260910212314_add_solicitud_contrasena_wifi/migration.sql`](../apps/controller/prisma/migrations/20260910212314_add_solicitud_contrasena_wifi/migration.sql).

## Cambio 2 — Migración marcada como aplicada en Prisma

Corrimos `prisma migrate resolve --applied` para esa única migración. Esto
solo actualiza la tabla de control interna de Prisma (`_prisma_migrations`)
de nuestro lado — no reejecuta SQL ni toca nada más de su historial.

## Lo que les pedimos confirmar

1. Que `solicitud_contrasena_wifi` no choca con ningún nombre/objeto que ya
   tengan planeado o en uso de su lado.
2. Que están al tanto del desfase de historiales de migración descrito
   arriba — nos interesa coordinar cómo evitarlo hacia adelante (¿base
   compartida con una sola fuente de migraciones, o cada equipo migra su
   propio dominio?). Esto conecta con la pregunta de mecanismo que sigue
   abierta desde el acuerdo del 12-09 (base compartida vs. API).
