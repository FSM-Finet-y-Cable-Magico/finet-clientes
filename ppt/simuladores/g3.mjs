// Simulador local de la API de G3 (cambio de clave WiFi) para la demo (rama ppt).
// Recibe la clave cifrada con RSA-OAEP SHA-256, como la manda el portal
// (apps/controller/src/common/g3/), la descifra con la llave privada local y la
// muestra en la consola para que se vea que llegó bien. Nunca habla con G3.
import http from "node:http";
import crypto from "node:crypto";
import fs from "node:fs";

const { G3_API_KEY, G3_LLAVE_PRIVADA } = process.env;
const PUERTO = Number(process.env.G3_PUERTO ?? 4901);
if (!G3_API_KEY || !G3_LLAVE_PRIVADA) {
  console.error("Falta G3_API_KEY o G3_LLAVE_PRIVADA: arráncalo con ppt/levantar.sh");
  process.exit(1);
}
const llavePrivada = fs.readFileSync(G3_LLAVE_PRIVADA, "utf8");
const solicitudes = new Map(); // request_id → { cuerpo, respuesta }
let siguienteId = 1;

const log = (msg) => console.log(`[G3 simulado] ${new Date().toLocaleTimeString("es-CL")} ${msg}`);
const enviar = (res, status, cuerpo) => {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(cuerpo));
};

http
  .createServer((req, res) => {
    let datos = "";
    req.on("data", (c) => (datos += c));
    req.on("end", () => {
      if (req.method === "GET" && req.url === "/salud") return enviar(res, 200, { ok: true });
      if (req.headers["x-api-key"] !== G3_API_KEY) return enviar(res, 401, { success: false, message: "API key inválida" });
      if (req.method !== "POST" || req.url !== "/api/integraciones/contrasena-wifi") {
        return enviar(res, 404, { success: false, message: "Ruta no simulada" });
      }
      let b;
      try { b = JSON.parse(datos); } catch { return enviar(res, 400, { success: false, message: "JSON inválido" }); }

      const previa = solicitudes.get(b.request_id);
      if (previa) {
        if (previa.cuerpo !== datos) return enviar(res, 409, { success: false, message: "request_id repetido con otro contenido" });
        return enviar(res, 200, { ...previa.respuesta, data: { ...previa.respuesta.data, duplicado: true } });
      }
      let clave;
      try {
        clave = crypto.privateDecrypt(
          { key: llavePrivada, padding: crypto.constants.RSA_PKCS1_OAEP_PADDING, oaepHash: "sha256" },
          Buffer.from(b.ciphertext, "base64"),
        ).toString("utf8");
      } catch {
        log("no se pudo descifrar la clave");
        return enviar(res, 422, { success: false, message: "No se pudo descifrar la clave" });
      }
      const respuesta = {
        success: true,
        data: { id_solicitud: siguienteId++, estado: "RECIBIDA", fecha: new Date().toISOString(), duplicado: false },
      };
      solicitudes.set(b.request_id, { cuerpo: datos, respuesta });
      log(`solicitud ${respuesta.data.id_solicitud}: ticket ${b.id_ticket}, contrato ${b.id_contrato}, empresa ${b.id_empresa}. ` +
          `Clave recibida y descifrada: «${clave}» (un técnico la aplicaría en el equipo).`);
      enviar(res, 201, respuesta);
    });
  })
  .listen(PUERTO, "127.0.0.1", () => log(`escuchando en http://127.0.0.1:${PUERTO}`));
