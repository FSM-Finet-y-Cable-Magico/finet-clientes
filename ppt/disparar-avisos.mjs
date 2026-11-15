// Corre a mano las dos tareas diarias del portal, las mismas que el cron lanza
// a las 9:00 (CU-67, recordatorio de pago) y a las 9:30 (CU-68, aviso de corte),
// con la API compilada de la demo. Lo arranca ppt/disparar-avisos.sh, con el
// mismo entorno de la API (base finet_ppt, G8 simulado y Mailpit).
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";

const controller = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../apps/controller");
const require = createRequire(path.join(controller, "package.json"));
const { NestFactory } = await import(pathToFileURL(require.resolve("@nestjs/core")).href);
const desde = (ruta) => import(pathToFileURL(path.join(controller, "dist/src", ruta)).href);
const { AppModule } = await desde("app.module.js");
const { RecordatorioPagoService } = await desde("notificaciones/recordatorio-pago.service.js");
const { AvisoCorteService } = await desde("notificaciones/aviso-corte.service.js");

const app = await NestFactory.createApplicationContext(AppModule, { logger: ["error", "warn"] });
const contar = (n, uno, varios) => `${n} ${n === 1 ? uno : varios}`;
const informar = (titulo, r, cuales) => {
  if (!r.ejecutada) {
    console.log(`${titulo}: no corrió${r.faltan.length ? ` (falta ${r.faltan.join(", ")})` : ""}.`);
    return;
  }
  const partes = [`${contar(r.detectadas, "cliente", "clientes")} con una factura que ${cuales}`, `${contar(r.enviados, "correo enviado", "correos enviados")}`];
  if (r.yaAvisados) partes.push(`${r.yaAvisados} ya avisado(s) hoy`);
  if (r.sinCanal) partes.push(`${r.sinCanal} sin correo`);
  if (r.fallidos) partes.push(`${r.fallidos} fallido(s)`);
  if (r.sinDatos) partes.push(`${r.sinDatos} sin respuesta de G8`);
  console.log(`${titulo}: ${partes.join(", ")}.`);
};

try {
  informar("Recordatorio de pago (CU-67, todos los días a las 9:00)",
    await app.get(RecordatorioPagoService).tandaDiaria(), "vence en 3 días");
  informar("Aviso de corte (CU-68, todos los días a las 9:30)",
    await app.get(AvisoCorteService).tandaDiaria(), "venció ayer");
} finally {
  await app.close();
}
