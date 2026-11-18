-- Datos de la demo local (rama ppt). Todo es ficticio y vive solo en la base
-- local finet_ppt. Las fechas son relativas al día en que se carga, para que
-- siempre haya facturas vencidas, dos que vencen en 3 días (recordatorio de
-- pago, una por empresa) y una que venció ayer (aviso de corte).
--
-- Contraseña de todas las cuentas creadas: Demo2026

BEGIN;

-- Empresas (los id coinciden con apps/controller/src/common/constants/empresas.ts).
INSERT INTO empresa (id_empresa, nombre) VALUES (1, 'Finet'), (2, 'Cable Mágico');

-- Planes: tipo_cliente en mayúsculas, como filtra el catálogo. Las velocidades
-- van de 200 a 900 Mbps, como dice la portada.
INSERT INTO plan (id_plan, id_empresa, nombre_comercial, tipo_plan, tipo_cliente, velocidad_mbps, precio_mensual, descripcion, activo) VALUES
  (1, 1, 'Fibra 200',          'fibra', 'RESIDENCIAL', 200,  15990, 'Para navegar, estudiar y ver series.', true),
  (2, 1, 'Fibra 600',          'fibra', 'RESIDENCIAL', 600,  19990, 'Para toda la familia conectada.',      true),
  (3, 1, 'Fibra 900',          'fibra', 'RESIDENCIAL', 900,  24990, 'Para teletrabajo y gaming.',           true),
  (4, 1, 'Fibra Pyme 600',     'fibra', 'EMPRESARIAL', 600,  29990, 'Para oficinas y comercios.',           true),
  (5, 1, 'Fibra Empresa 900',  'fibra', 'EMPRESARIAL', 900,  44990, 'Para empresas con alto tráfico.',      true),
  (6, 2, 'Litoral 200',        'fibra', 'RESIDENCIAL', 200,  14990, 'Para la casa en la costa.',            true),
  (7, 2, 'Litoral 500',        'fibra', 'RESIDENCIAL', 500,  18990, 'Para toda la familia.',                true),
  (8, 2, 'Litoral Negocio 500','fibra', 'EMPRESARIAL', 500,  27990, 'Para negocios del litoral.',           true);

-- Categorías de ticket: las 7 que ve el cliente, la del cambio de clave WiFi
-- y la del asistente.
INSERT INTO categoria_falla (id_categoria, nombre, sla_horas) VALUES
  (1, 'Falla de Internet', 24), (2, 'Falla de TV', 24), (3, 'Cambio de plan', 72),
  (4, 'Mudanza', 120), (5, 'Facturación y cobro', 72), (6, 'Consulta general', 72),
  (7, 'Baja de servicio', 24), (8, 'CAMBIO_CREDENCIALES_WIFI', 24), (9, 'Asistente virtual', 24);

-- Operador de Soporte: recibe el correo cuando el asistente no logra crear un ticket.
INSERT INTO rol (id_rol, nombre_rol, descripcion) VALUES (1, 'SOPORTE', 'Operador de soporte');
INSERT INTO usuario (id_usuario, id_empresa, nombre_completo, nombre_usuario, email, password_hash, activo)
VALUES (1, 1, 'Soporte Demo', 'soporte.demo', 'soporte@finet-demo.test',
        '$2b$10$R4lNkPy2V.CFAQ9YS4T7ru3LkiMHRkoAHThxvMp3pMcKdH6lFYVdW', true);
INSERT INTO usuario_rol (id_usuario, id_rol, fecha_asignacion) VALUES (1, 1, CURRENT_DATE);

-- Clientes. Los que tienen cuenta usan la contraseña Demo2026; los que no,
-- sirven para mostrar el registro. La fecha de alta lleva hora: a medianoche,
-- en hora de Chile, «Cliente desde» saldría un día antes.
INSERT INTO cliente (id_cliente, id_empresa, rut, nombre_completo, email, telefono, password_portal_hash, estado, fecha_creacion) VALUES
  (1, 1, '16234567-2', 'Camila Rojas Fuentes',  'camila.rojas@finet-demo.test',     '+56911112222',
      '$2b$10$R4lNkPy2V.CFAQ9YS4T7ru3LkiMHRkoAHThxvMp3pMcKdH6lFYVdW', 'activo', CURRENT_DATE - 300 + TIME '10:30'),
  (2, 1, '17345678-6', 'Diego Muñoz Lagos',     'diego.munoz@finet-demo.test',      '+56922223333', NULL, 'activo', CURRENT_DATE - 120 + TIME '10:30'),
  (3, 1, '15456789-5', 'Sofía Pérez Araya',     'sofia.perez@finet-demo.test',      '+56933334444',
      '$2b$10$R4lNkPy2V.CFAQ9YS4T7ru3LkiMHRkoAHThxvMp3pMcKdH6lFYVdW', 'activo', CURRENT_DATE - 200 + TIME '10:30'),
  (4, 2, '18567890-3', 'Matías González Vera',  'matias.gonzalez@cable-demo.test',  '+56944445555',
      '$2b$10$R4lNkPy2V.CFAQ9YS4T7ru3LkiMHRkoAHThxvMp3pMcKdH6lFYVdW', 'activo', CURRENT_DATE - 250 + TIME '10:30'),
  (5, 2, '19678901-4', 'Valentina Soto Ríos',   'valentina.soto@cable-demo.test',   '+56955556666', NULL, 'activo', CURRENT_DATE - 90 + TIME '10:30'),
  -- Ignacio pidió su plan desde «Contratar», G8 aprobó la solicitud y quedó
  -- instalado ayer: está listo para crear su cuenta en el portal.
  (6, 1, '22456789-8', 'Ignacio Fuentes Rojas', 'ignacio.fuentes@finet-demo.test',  '+56966667777', NULL, 'activo', CURRENT_DATE - 1 + TIME '10:30'),
  -- Rodrigo tiene dos planes vigentes (su casa y su oficina) y está al día.
  (7, 1, '17890123-0', 'Rodrigo Vidal Soto',    'rodrigo.vidal@finet-demo.test',    '+56977778888',
      '$2b$10$R4lNkPy2V.CFAQ9YS4T7ru3LkiMHRkoAHThxvMp3pMcKdH6lFYVdW', 'activo', CURRENT_DATE - 400 + TIME '10:30');

-- Contratos: Sofía está suspendida (no puede pedir el cambio de clave WiFi).
-- El día de pago de cada contrato calza con el vencimiento de sus facturas.
INSERT INTO contrato (id_contrato, id_cliente, id_plan, id_empresa, fecha_inicio, dia_vencimiento, estado, fecha_suspension) VALUES
  (1, 1, 2, 1, CURRENT_DATE - 300, extract(day FROM CURRENT_DATE + 3),  'ACTIVO',     NULL),
  (2, 2, 1, 1, CURRENT_DATE - 120, extract(day FROM CURRENT_DATE - 1),  'ACTIVO',     NULL),
  (3, 3, 1, 1, CURRENT_DATE - 200, extract(day FROM CURRENT_DATE - 20), 'SUSPENDIDO', CURRENT_DATE - 5),
  (4, 4, 7, 2, CURRENT_DATE - 250, extract(day FROM CURRENT_DATE + 3),  'ACTIVO',     NULL),
  (5, 5, 6, 2, CURRENT_DATE - 90,  extract(day FROM CURRENT_DATE - 5),  'ACTIVO',     NULL),
  (6, 6, 2, 1, CURRENT_DATE - 1,   extract(day FROM CURRENT_DATE - 1),  'ACTIVO',     NULL),
  (7, 7, 2, 1, CURRENT_DATE - 400, extract(day FROM CURRENT_DATE - 8),  'ACTIVO',     NULL),
  (8, 7, 4, 1, CURRENT_DATE - 150, extract(day FROM CURRENT_DATE - 8),  'ACTIVO',     NULL);

-- Servicio Internet de cada contrato (lo exige el cambio de clave WiFi).
INSERT INTO servicio_contratado (id_servicio, id_cliente, id_empresa, id_contrato, tipo_servicio, estado_operativo) VALUES
  (1, 1, 1, 1, 'Internet', 'Operativo'), (2, 2, 1, 2, 'Internet', 'Operativo'),
  (3, 3, 1, 3, 'Internet', 'Suspendido'), (4, 4, 2, 4, 'Internet', 'Operativo'),
  (5, 5, 2, 5, 'Internet', 'Operativo'), (6, 6, 1, 6, 'Internet', 'Operativo'),
  (7, 7, 1, 7, 'Internet', 'Operativo'), (8, 7, 1, 8, 'Internet', 'Operativo');

-- La solicitud de Ignacio, como la deja el formulario de contratar y ya
-- convertida en cliente por G8, con su dirección de instalación.
INSERT INTO prospecto (id_prospecto, id_empresa, id_cliente, rut, nombre_completo, email, telefono, direccion, comuna, region,
                       origen_contacto, id_plan_interes, estado_pipeline, fecha_creacion, fecha_conversion, tiempo_conversion_dias) VALUES
  (1, 1, 6, '224567898', 'Ignacio Fuentes Rojas', 'ignacio.fuentes@finet-demo.test', '+56966667777', 'Pasaje Los Aromos 1234',
   'La Pintana', 'Metropolitana de Santiago', 'Formulario web', 2, 'Prospecto Nuevo', CURRENT_DATE - 6 + TIME '18:20', CURRENT_DATE - 1, 5);
INSERT INTO direccion_servicio (id_direccion, id_cliente, direccion_completa, comuna, es_principal) VALUES
  (1, 6, 'Pasaje Los Aromos 1234', 'La Pintana', true);

-- Facturas mensuales: cada una cobra el mes anterior al de su vencimiento, se
-- emite el día 1 del mes en que vence y vence el día de pago del contrato.
INSERT INTO factura (id_factura, id_contrato, periodo_mes, periodo_anio, monto, fecha_emision, fecha_limite_pago, estado)
SELECT id, contrato, extract(month FROM periodo)::smallint, extract(year FROM periodo)::smallint,
       monto, date_trunc('month', limite)::date, limite, estado
FROM (
  SELECT id, contrato, monto, limite::date AS limite, (limite - interval '1 month')::date AS periodo, estado
  FROM (VALUES
    -- Camila: una pagada, una vencida y una que vence en 3 días (recordatorio).
    (1,  1, 19990, CURRENT_DATE + 3 - interval '2 month',  'Pagada'),
    (2,  1, 19990, CURRENT_DATE + 3 - interval '1 month',  'Pendiente'),
    (3,  1, 19990, CURRENT_DATE + 3 + interval '0 month',  'Pendiente'),
    -- Diego: una pagada y una que venció ayer (aviso de corte).
    (4,  2, 15990, CURRENT_DATE - 1 - interval '1 month',  'Pagada'),
    (5,  2, 15990, CURRENT_DATE - 1 + interval '0 month',  'Pendiente'),
    -- Sofía: dos vencidas; por eso está suspendida.
    (6,  3, 15990, CURRENT_DATE - 20 - interval '1 month', 'Pendiente'),
    (7,  3, 15990, CURRENT_DATE - 20 + interval '0 month', 'Pendiente'),
    -- Matías: una pagada y una que vence en 3 días (recordatorio).
    (8,  4, 18990, CURRENT_DATE + 3 - interval '1 month',  'Pagada'),
    (9,  4, 18990, CURRENT_DATE + 3 + interval '0 month',  'Pendiente'),
    -- Valentina: al día.
    (10, 5, 14990, CURRENT_DATE - 5 + interval '0 month',  'Pagada'),
    -- Rodrigo: al día en sus dos planes.
    (11, 7, 19990, CURRENT_DATE - 8 + interval '0 month',  'Pagada'),
    (12, 8, 29990, CURRENT_DATE - 8 + interval '0 month',  'Pagada')
  ) AS v(id, contrato, monto, limite, estado)
) AS f;

-- Pagos de las facturas pagadas, dos días antes del vencimiento (el
-- comprobante se genera al descargarlo).
INSERT INTO pago (id_pago, id_factura, id_cliente, monto, fecha_pago, codigo_transaccion, pasarela, codigo_autorizacion, comprobante_estado)
SELECT p.id, f.id_factura, c.id_cliente, f.monto, f.fecha_limite_pago - 2 + p.hora,
       'F' || f.id_factura || '-DEMO', 'webpay', '1213', 'PENDIENTE'
FROM (VALUES (1, 1, TIME '11:32'), (2, 4, TIME '09:15'), (3, 8, TIME '18:40'), (4, 10, TIME '13:05'),
             (5, 11, TIME '20:10'), (6, 12, TIME '20:12'))
       AS p(id, factura, hora)
JOIN factura f ON f.id_factura = p.factura
JOIN contrato c ON c.id_contrato = f.id_contrato;

-- Tickets: el código sigue el formato del portal (FIN-<año>-<id de 6 dígitos>).
INSERT INTO ticket (id_ticket, id_cliente, id_empresa, id_categoria, codigo_seguimiento, prioridad, estado, descripcion, fecha_creacion, fecha_cierre, origen)
SELECT id, cliente, empresa, categoria,
       'FIN-' || extract(year FROM creado)::int || '-' || lpad(id::text, 6, '0'),
       prioridad, estado, descripcion, creado, cerrado, 'PORTAL'
FROM (VALUES
  (1, 1, 1, 5, 'BAJA',  'RESUELTO', 'La cuenta del mes pasado llegó con un monto distinto al del plan.',
      CURRENT_DATE - 40 + TIME '09:40', CURRENT_DATE - 38 + TIME '16:05'),
  (2, 1, 1, 1, 'MEDIA', 'ABIERTO',  'Desde ayer en la tarde el Internet se corta a cada rato. Ya reinicié el router.',
      CURRENT_DATE - 1 + TIME '10:12', NULL::timestamp),
  (3, 4, 2, 6, 'BAJA',  'ABIERTO',  'Quiero saber si puedo cambiarme al plan de 500 Mbps.',
      CURRENT_DATE - 3 + TIME '17:20', NULL::timestamp)
) AS t(id, cliente, empresa, categoria, prioridad, estado, descripcion, creado, cerrado);

-- Las secuencias siguen después de los id cargados a mano.
\o /dev/null
SELECT setval(pg_get_serial_sequence('empresa', 'id_empresa'), 2);
SELECT setval(pg_get_serial_sequence('plan', 'id_plan'), 8);
SELECT setval(pg_get_serial_sequence('categoria_falla', 'id_categoria'), 9);
SELECT setval(pg_get_serial_sequence('rol', 'id_rol'), 1);
SELECT setval(pg_get_serial_sequence('usuario', 'id_usuario'), 1);
SELECT setval(pg_get_serial_sequence('cliente', 'id_cliente'), 7);
SELECT setval(pg_get_serial_sequence('contrato', 'id_contrato'), 8);
SELECT setval(pg_get_serial_sequence('prospecto', 'id_prospecto'), 1);
SELECT setval(pg_get_serial_sequence('direccion_servicio', 'id_direccion'), 1);
SELECT setval(pg_get_serial_sequence('servicio_contratado', 'id_servicio'), 8);
SELECT setval(pg_get_serial_sequence('factura', 'id_factura'), 12);
SELECT setval(pg_get_serial_sequence('pago', 'id_pago'), 6);
SELECT setval(pg_get_serial_sequence('ticket', 'id_ticket'), 3);

\o

COMMIT;
