// Simulador local de la API de G8 para la demo (rama ppt). Implementa las tres
// llamadas que hace el portal (apps/controller/src/common/g8/) contra la base
// local finet_ppt. Nunca habla con G8 ni con la base compartida.
import http from "node:http";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
import path from "node:path";

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const require = createRequire(path.join(raiz, "apps/controller/package.json"));
const pg = require(require.resolve("pg", { paths: [require.resolve("@prisma/adapter-pg")] }));

const { PPT_DATABASE_URL, G8_API_KEY } = process.env;
const PUERTO = Number(process.env.G8_PUERTO ?? 4900);
if (!PPT_DATABASE_URL?.includes("/finet_ppt") || !G8_API_KEY) {
  console.error("Falta PPT_DATABASE_URL (finet_ppt) o G8_API_KEY: arráncalo con ppt/levantar.sh");
  process.exit(1);
}
const db = new pg.Pool({ connectionString: PPT_DATABASE_URL });

const log = (msg) => console.log(`[G8 simulado] ${new Date().toLocaleTimeString("es-CL")} ${msg}`);
const fecha = (d) => (d ? new Date(d).toLocaleDateString("en-CA") : null);
const enviar = (res, status, cuerpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};
const leerCuerpo = (req) =>
  new Promise((ok, mal) => {
    let datos = "";
    req.on("data", (c) => (datos += c));
    req.on("end", () => {
      try { ok(datos ? JSON.parse(datos) : {}); } catch (e) { mal(e); }
    });
  });

// GET /api/integrations/g2/invoices?id_empresa=&id_cliente=
async function facturas(url, res) {
  const idCliente = Number(url.searchParams.get("id_cliente"));
  const idEmpresa = Number(url.searchParams.get("id_empresa"));
  const { rows } = await db.query(
    `SELECT f.id_factura, f.monto, f.fecha_limite_pago
       FROM factura f JOIN contrato c ON c.id_contrato = f.id_contrato
      WHERE c.id_cliente = $1 AND COALESCE(c.id_empresa, 1) = $2
        AND lower(f.estado) IN ('pendiente', 'vencida')
      ORDER BY f.fecha_limite_pago`,
    [idCliente, idEmpresa],
  );
  log(`facturas del cliente ${idCliente} (empresa ${idEmpresa}): ${rows.length} con saldo`);
  enviar(res, 200, {
    items: rows.map((f) => ({
      idFactura: f.id_factura,
      saldoExigible: Number(f.monto),
      fechaVencimientoEfectiva: fecha(f.fecha_limite_pago),
      aceptaPagos: true,
    })),
  });
}

// POST /api/integrations/g2/payments: registra el pago como lo haría G8.
async function pagos(req, res) {
  const b = await leerCuerpo(req);
  const previo = await db.query("SELECT id_pago FROM pago WHERE codigo_transaccion = $1", [b.codigo_transaccion]);
  if (previo.rows.length) {
    log(`pago repetido (${b.codigo_transaccion}): se devuelve el mismo id_pago ${previo.rows[0].id_pago}`);
    return enviar(res, 200, { success: true, data: { id_pago: previo.rows[0].id_pago, duplicado: true } });
  }
  const { rows } = await db.query(
    `SELECT f.id_factura, f.monto, c.id_cliente FROM factura f
       JOIN contrato c ON c.id_contrato = f.id_contrato
      WHERE f.id_factura = $1 AND COALESCE(c.id_empresa, 1) = $2 AND lower(f.estado) IN ('pendiente', 'vencida')`,
    [b.id_factura, b.id_empresa],
  );
  const factura = rows[0];
  if (!factura || Number(factura.monto) !== Number(b.monto)) {
    log(`pago rechazado: la factura ${b.id_factura} no existe, ya está pagada o el monto no calza`);
    return enviar(res, 422, { success: false, message: "Factura no pagable o monto distinto" });
  }
  const cliente = await db.connect();
  try {
    await cliente.query("BEGIN");
    const pago = await cliente.query(
      `INSERT INTO pago (id_factura, id_cliente, monto, fecha_pago, codigo_transaccion, codigo_autorizacion, pasarela, comprobante_estado)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'PENDIENTE') RETURNING id_pago`,
      [b.id_factura, factura.id_cliente, b.monto, new Date(b.fecha_pago), b.codigo_transaccion, b.codigo_autorizacion, b.pasarela ?? "webpay"],
    );
    await cliente.query("UPDATE factura SET estado = 'Pagada' WHERE id_factura = $1", [b.id_factura]);
    await cliente.query("COMMIT");
    log(`pago registrado: factura ${b.id_factura} por $${Number(b.monto).toLocaleString("es-CL")} (id_pago ${pago.rows[0].id_pago})`);
    enviar(res, 201, { success: true, data: { id_pago: pago.rows[0].id_pago, duplicado: false } });
  } catch (e) {
    await cliente.query("ROLLBACK");
    throw e;
  } finally {
    cliente.release();
  }
}

// POST /api/integrations/g2/tickets/{id}/wifi-result: G8 deriva el ticket.
async function resultadoWifi(id, req, res) {
  const b = await leerCuerpo(req);
  await db.query("UPDATE ticket SET estado = 'ESCALADO' WHERE id_ticket = $1", [id]);
  log(`resultado WiFi del ticket ${id}: ${b.resultado} → ticket ESCALADO`);
  enviar(res, 200, { success: true });
}

http
  .createServer(async (req, res) => {
    try {
      const url = new URL(req.url, "http://localhost");
      if (req.method === "GET" && url.pathname === "/salud") return enviar(res, 200, { ok: true });
      if (req.headers["x-api-key"] !== G8_API_KEY) return enviar(res, 401, { success: false, message: "API key inválida" });
      if (req.method === "GET" && url.pathname === "/api/integrations/g2/invoices") return await facturas(url, res);
      if (req.method === "POST" && url.pathname === "/api/integrations/g2/payments") return await pagos(req, res);
      const wifi = url.pathname.match(/^\/api\/integrations\/g2\/tickets\/(\d+)\/wifi-result$/);
      if (req.method === "POST" && wifi) return await resultadoWifi(Number(wifi[1]), req, res);
      enviar(res, 404, { success: false, message: "Ruta no simulada" });
    } catch (e) {
      log(`error: ${e.message}`);
      enviar(res, 500, { success: false, message: "Error del simulador" });
    }
  })
  .listen(PUERTO, "127.0.0.1", () => log(`escuchando en http://127.0.0.1:${PUERTO}`));
