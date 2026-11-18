// Prueba de punta a punta de la demo local (rama ppt). La arranca
// ppt/probar-todo.sh con la demo recién levantada sobre la base de cero y con
// Mailpit. Cada flujo queda ✓ o ✗; los ✗ dejan su captura en
// ppt/.local/e2e/capturas/ y el reporte queda en ppt/.local/e2e/reporte.md.
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const PPT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const E2E = process.env.E2E_DIR ?? path.join(PPT, ".local/e2e");
const LOGS = process.env.LOG_DIR ?? path.join(PPT, ".local/logs");
const { chromium } = createRequire(path.join(E2E, "package.json"))("playwright");
const requerirApi = createRequire(path.join(PPT, "../apps/controller/package.json"));
const pg = requerirApi(requerirApi.resolve("pg", { paths: [requerirApi.resolve("@prisma/adapter-pg")] }));

if (!process.env.PPT_DATABASE_URL?.includes("/finet_ppt")) {
  console.error("Falta PPT_DATABASE_URL (finet_ppt): arráncalo con ppt/probar-todo.sh");
  process.exit(1);
}
const db = new pg.Pool({ connectionString: process.env.PPT_DATABASE_URL });

const SITIO = "http://localhost:3000";
const MAILPIT = "http://127.0.0.1:8025/api/v1";
const CLAVE = "Demo2026";
const CAPTURAS = path.join(E2E, "capturas");
fs.rmSync(CAPTURAS, { recursive: true, force: true });
fs.mkdirSync(CAPTURAS, { recursive: true });

const ESCRITORIO = { nombre: "escritorio", opciones: { viewport: { width: 1366, height: 900 } } };
const CELULAR = {
  nombre: "celular",
  opciones: { viewport: { width: 393, height: 852 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

const esperar = (ms) => new Promise((ok) => setTimeout(ok, ms));
const exigir = (condicion, mensaje) => {
  if (!condicion) throw new Error(mensaje);
};

// ─── Navegador y páginas ───────────────────────────────────────────────────
const navegador = await chromium.launch();
let paginas = [];

async function nuevaPagina(dispositivo = ESCRITORIO) {
  const ctx = await navegador.newContext({
    ...dispositivo.opciones,
    locale: "es-CL",
    timezoneId: "America/Santiago",
  });
  const page = await ctx.newPage();
  page.problemas = [];
  page.on("console", (m) => {
    if (m.type() === "error") page.problemas.push(`consola: ${m.text().slice(0, 160)}`);
  });
  page.on("pageerror", (e) => page.problemas.push(`error: ${e.message.slice(0, 160)}`));
  page.on("response", (r) => {
    const u = new URL(r.url());
    if (u.hostname === "localhost" && r.status() >= 400) {
      page.problemas.push(`HTTP ${r.status()} ${r.request().method()} ${u.pathname}`);
    }
  });
  paginas.push(page);
  return page;
}

async function cerrarPaginas() {
  for (const p of paginas) await p.context().close().catch(() => {});
  paginas = [];
}

async function aceptarCookies(page) {
  const boton = page.getByRole("button", { name: "Aceptar", exact: true });
  if (await boton.isVisible().catch(() => false)) {
    await boton.click();
    await esperar(300);
  }
}

async function abrir(page, ruta) {
  const respuesta = await page.goto(SITIO + ruta, { waitUntil: "load" });
  await esperar(700);
  await aceptarCookies(page);
  return respuesta;
}

const marcaDe = (page) => page.locator("[data-brand]").first().getAttribute("data-brand");
const rutaDe = (page) => new URL(page.url()).pathname;
const cookieMarca = async (page) =>
  (await page.context().cookies()).find((c) => c.name === "empresa")?.value ?? null;

async function comprobarMarca(page, marca, ruta) {
  const [m, r, c] = [await marcaDe(page), rutaDe(page), await cookieMarca(page)];
  exigir(m === marca && r === ruta && c === marca, `se esperaba ${marca} en ${ruta}; quedó ${m} en ${r} (cookie ${c})`);
}

async function intentarEntrar(page, rut, clave) {
  await page.getByLabel(/RUT/i).first().fill(rut);
  await page.getByLabel(/Contraseña/i).first().fill(clave);
  const [respuesta] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith("/api/auth/login")),
    page.getByRole("button", { name: "Ingresar", exact: true }).click(),
  ]);
  const cuerpo = await respuesta.json().catch(() => ({}));
  return { status: respuesta.status(), mensaje: cuerpo.message };
}

/** Entra desde el login de la empresa (Finet por /finet/…, explícito). */
async function entrar(page, prefijo, rut, clave = CLAVE) {
  await abrir(page, `${prefijo || "/finet"}/inicio-sesion`);
  const r = await intentarEntrar(page, rut, clave);
  exigir(r.status === 200, `no pudo entrar ${rut}: ${r.status} ${r.mensaje ?? ""}`);
  await page.waitForURL(/\/portal/, { timeout: 20000 });
  await esperar(800);
}

/** Un enlace del menú del portal (en celular, primero se abre el menú). */
async function menuPortal(page, nombre) {
  const visible = () => page.getByRole("link", { name: nombre, exact: true }).filter({ visible: true }).first();
  if (!(await visible().count())) {
    await page.getByRole("button", { name: "Abrir menu del portal" }).click();
    await esperar(500);
  }
  await visible().click();
  await esperar(1800);
}

async function elegirMarca(page, nombre) {
  const antes = page.url();
  await page.getByRole("button", { name: nombre, exact: true }).filter({ visible: true }).first().click();
  await page.waitForFunction((previa) => location.href !== previa, antes, { timeout: 20000 });
  await page.waitForLoadState("load");
  await esperar(1200);
}

async function verPerfilYPanel(page, marca, nombre) {
  await menuPortal(page, "Mi Perfil");
  await page.getByText("Mis Datos Personales").first().waitFor({ timeout: 15000 });
  await page.getByText(nombre).first().waitFor({ timeout: 15000 });
  exigir(!(await page.getByText("No se pudo cargar la información").count()), "Mi Perfil no cargó");
  exigir((await marcaDe(page)) === marca, `Mi Perfil quedó en ${await marcaDe(page)}`);
  await menuPortal(page, "Panel");
  await page.getByText(`Bienvenido, ${nombre.split(" ")[0]}`).first().waitFor({ timeout: 15000 });
}

function sinProblemas(page, tipos = ["HTTP 404", "error:"]) {
  const malos = page.problemas.filter((p) => tipos.some((t) => p.startsWith(t)));
  exigir(!malos.length, malos.slice(0, 5).join(" | "));
}

// ─── Correo (Mailpit) y base ───────────────────────────────────────────────
async function borrarCorreos() {
  await fetch(`${MAILPIT}/messages`, { method: "DELETE" });
}

async function buscarCorreos(consulta) {
  const r = await fetch(`${MAILPIT}/search?query=${encodeURIComponent(consulta)}&limit=50`);
  return (await r.json()).messages ?? [];
}

async function esperarCorreo(consulta, { minimo = 1, segundos = 40 } = {}) {
  for (let i = 0; i < segundos * 2; i++) {
    const mensajes = await buscarCorreos(consulta);
    if (mensajes.length >= minimo) return mensajes;
    await esperar(500);
  }
  throw new Error(`no llegó el correo (${consulta})`);
}

const detalleCorreo = async (id) => (await fetch(`${MAILPIT}/message/${id}`)).json();

function enlaceDe(texto, patron) {
  const m = texto.match(new RegExp(`https?://\\S*${patron}\\S*`));
  exigir(m, `el correo no trae el enlace ${patron}`);
  return m[0];
}

const consulta = async (sql, params = []) => (await db.query(sql, params)).rows;
const correoDe = async (rut) => (await consulta("SELECT email FROM cliente WHERE rut = $1", [rut]))[0]?.email;
const contarAuditoria = async (accion) =>
  Number((await consulta("SELECT count(*) n FROM log_auditoria WHERE accion = $1", [accion]))[0].n);
const leerLog = (nombre) => fs.readFileSync(path.join(LOGS, `${nombre}.log`), "utf8");
const correr = (script, args = []) =>
  execFileSync(path.join(PPT, script), args, { encoding: "utf8", env: { ...process.env, PPT_CORREO: "mailpit" } });

// ─── Flujos ────────────────────────────────────────────────────────────────
const resultados = [];

async function flujo(nombre, fn) {
  // SOLO="Chatbot" corre solo los flujos cuyo nombre lo contiene.
  if (process.env.SOLO && !nombre.includes(process.env.SOLO)) return;
  const inicio = Date.now();
  try {
    await fn();
    resultados.push({ nombre, ok: true, s: Math.round((Date.now() - inicio) / 1000) });
    console.log(`✓ ${nombre}`);
  } catch (e) {
    const archivo = nombre.replace(/[^a-zA-Z0-9áéíóúñ]+/g, "-").slice(0, 70);
    for (const [i, p] of paginas.entries()) {
      await p.screenshot({ path: path.join(CAPTURAS, `${archivo}-${i}.png`), fullPage: true }).catch(() => {});
    }
    resultados.push({ nombre, ok: false, error: e.message.split("\n")[0], s: Math.round((Date.now() - inicio) / 1000) });
    console.log(`✗ ${nombre}\n    ${e.message.split("\n")[0]}`);
  } finally {
    await cerrarPaginas();
  }
}

const PUBLICAS = ["/", "/planes", "/empresas", "/cobertura", "/velocidad", "/ayuda", "/consultar-deuda",
  "/inicio-sesion", "/recuperar-password", "/terminos", "/privacidad", "/pagar"];

// 1. Los avisos van primero: necesitan las facturas por vencer sin pagar.
await flujo("Avisos: 2 recordatorios de pago y 1 aviso de corte, cada uno con el remitente de su empresa", async () => {
  await borrarCorreos();
  correr("disparar-avisos.sh");
  const recordatorios = await esperarCorreo('subject:"Tu factura vence en 3 días"', { minimo: 2 });
  const cortes = await esperarCorreo('subject:"Aviso de corte"', { minimo: 1 });
  exigir(recordatorios.length === 2 && cortes.length === 1,
    `llegaron ${recordatorios.length} recordatorios y ${cortes.length} avisos de corte`);
  const remitentes = new Set(recordatorios.map((m) => m.From.Address));
  exigir(remitentes.size === 2, `los recordatorios salieron de ${[...remitentes].join(", ")}`);
});

for (const dispositivo of [ESCRITORIO, CELULAR]) {
  await flujo(`Páginas públicas de las dos empresas, sin errores (${dispositivo.nombre})`, async () => {
    const fallas = [];
    for (const [prefijo, marca] of [["", "finet"], ["/cable-magico", "cable-magico"]]) {
      const page = await nuevaPagina(dispositivo);
      for (const ruta of PUBLICAS) {
        const url = prefijo ? `${prefijo}${ruta === "/" ? "" : ruta}` : ruta;
        const r = await abrir(page, url);
        if (r.status() !== 200) fallas.push(`${url} → ${r.status()}`);
        if ((await marcaDe(page)) !== marca) fallas.push(`${url} salió como ${await marcaDe(page)}`);
      }
      fallas.push(...page.problemas.map((p) => `${marca}: ${p}`));
    }
    exigir(!fallas.length, fallas.slice(0, 6).join(" | "));
  });

  await flujo(`Ida y vuelta Finet ↔ Cable Mágico con el selector, sin sesión (${dispositivo.nombre})`, async () => {
    const page = await nuevaPagina(dispositivo);
    await abrir(page, "/cable-magico/planes");
    for (let i = 0; i < 3; i++) {
      await elegirMarca(page, "Finet");
      await comprobarMarca(page, "finet", "/planes");
      await elegirMarca(page, "Cable Mágico");
      await comprobarMarca(page, "cable-magico", "/cable-magico/planes");
    }
    // Con la empresa elegida, una dirección sin prefijo sigue en ella.
    await abrir(page, "/ayuda");
    await comprobarMarca(page, "cable-magico", "/cable-magico/ayuda");
    await elegirMarca(page, "Finet");
    await abrir(page, "/inicio-sesion");
    await comprobarMarca(page, "finet", "/inicio-sesion");
    sinProblemas(page);
  });

  await flujo(`Ida y vuelta con sesión: Camila → Matías → Camila, con Mi Perfil y Panel (${dispositivo.nombre})`, async () => {
    const page = await nuevaPagina(dispositivo);
    await entrar(page, "", "16.234.567-2");
    exigir((await marcaDe(page)) === "finet", "Camila no quedó en Finet");
    await elegirMarca(page, "Cable Mágico");
    exigir((await marcaDe(page)) === "cable-magico", `al elegir Cable Mágico quedó en ${await marcaDe(page)}`);
    exigir(rutaDe(page) === "/cable-magico/inicio-sesion", `con la sesión cerrada debía ir al login; quedó en ${rutaDe(page)}`);
    await entrar(page, "/cable-magico", "18.567.890-3");
    await verPerfilYPanel(page, "cable-magico", "Matías González Vera");
    await elegirMarca(page, "Finet");
    exigir((await marcaDe(page)) === "finet" && rutaDe(page) === "/inicio-sesion",
      `al elegir Finet quedó ${await marcaDe(page)} en ${rutaDe(page)}`);
    await entrar(page, "", "16.234.567-2");
    await verPerfilYPanel(page, "finet", "Camila Rojas Fuentes");
    sinProblemas(page);
  });

  for (const [prefijo, rut, marca] of [["", "15.456.789-5", "finet"], ["/cable-magico", "18.567.890-3", "cable-magico"]]) {
    await flujo(`Sesión cerrada desde otro navegador → Mi Perfil lleva al login de su empresa (${marca}, ${dispositivo.nombre})`, async () => {
      const a = await nuevaPagina(dispositivo);
      await entrar(a, prefijo, rut);
      const b = await nuevaPagina(dispositivo);
      await entrar(b, prefijo, rut); // una sola sesión por cliente: cierra la de «a»
      await menuPortal(a, "Mi Perfil");
      await a.waitForURL(/inicio-sesion\?expired=1/, { timeout: 15000 });
      exigir((await marcaDe(a)) === marca && rutaDe(a) === `${prefijo}/inicio-sesion`,
        `fue a ${rutaDe(a)} (${await marcaDe(a)})`);
      await a.getByText("Tu sesión fue cerrada por inactividad").waitFor({ timeout: 10000 });
    });
  }
}

await flujo("Matías desde Finet da error, y 6 errores seguidos no bloquean a nadie", async () => {
  const page = await nuevaPagina();
  await abrir(page, "/finet/inicio-sesion");
  const r = await intentarEntrar(page, "18.567.890-3", CLAVE);
  exigir(r.status === 401 && r.mensaje === "RUT o contraseña incorrectos", `Matías en Finet: ${r.status} ${r.mensaje}`);
  for (const rut of ["11.111.111-1", "22.222.222-2", "33.333.333-3", "44.444.444-4", "55.555.555-5", "66.666.666-6"]) {
    const e = await intentarEntrar(page, rut, "OtraClave1");
    exigir(e.status === 401 && e.mensaje === "RUT o contraseña incorrectos", `${rut}: ${e.status} ${e.mensaje}`);
  }
  await entrar(page, "", "16.234.567-2");
});

await flujo("Sofía (suspendida): el cambio de clave WiFi avisa que no se puede, y su deuda se ve sin sesión", async () => {
  const page = await nuevaPagina();
  await entrar(page, "", "15.456.789-5");
  await menuPortal(page, "Mis Servicios");
  await page.getByText("Solo puedes solicitar el cambio de clave cuando tienes un servicio").waitFor({ timeout: 10000 });
  exigir(!(await page.getByRole("button", { name: "Solicitar cambio" }).count()), "con el contrato suspendido igual aparece el formulario");
  const visita = await nuevaPagina();
  await abrir(visita, "/consultar-deuda");
  await visita.getByLabel(/RUT/i).first().fill("15.456.789-5");
  await visita.locator("#main-content").getByRole("button", { name: /Consultar/ }).click();
  await visita.getByText("$31.980").first().waitFor({ timeout: 15000 });
});

await flujo("Recuperar contraseña (Sofía): enlace por correo, contraseña nueva, aviso y entrar con ella", async () => {
  await borrarCorreos();
  const page = await nuevaPagina();
  await abrir(page, "/finet/recuperar-password");
  await page.getByLabel(/RUT/i).first().fill("15.456.789-5");
  await page.getByRole("button", { name: "Enviar enlace" }).click();
  await page.getByText("Revisa tu correo").waitFor({ timeout: 15000 });
  const correo = await correoDe("15456789-5");
  const [m] = await esperarCorreo(`to:"${correo}" subject:"Recuperación de contraseña"`);
  await page.goto(enlaceDe((await detalleCorreo(m.ID)).Text, "restablecer-password"), { waitUntil: "load" });
  await page.locator('input[type="password"]').first().waitFor();
  await esperar(1500);
  for (const campo of await page.locator('input[type="password"]').all()) await campo.fill("Nueva2026");
  await page.locator('button[type="submit"]').first().click();
  await page.getByText("Contraseña actualizada").first().waitFor({ timeout: 15000 });
  await esperarCorreo(`to:"${correo}" subject:"Contraseña actualizada"`);
  await entrar(page, "", "15.456.789-5", "Nueva2026");
});

for (const [prefijo, rut, rutBD, marca, nombre, total] of [
  ["", "16.234.567-2", "16234567-2", "finet", "Camila", "$39.980"],
  ["/cable-magico", "18.567.890-3", "18567890-3", "cable-magico", "Matías", "$18.990"],
]) {
  await flujo(`${nombre} (${marca}): panel, deuda, comprobante, ticket y clave WiFi`, async () => {
    await borrarCorreos();
    const page = await nuevaPagina();
    await entrar(page, prefijo, rut);
    await page.getByText(total).first().waitFor({ timeout: 15000 });
    exigir(!(await page.getByText(/— ABIERTO/).count()), "el Panel muestra el estado del ticket en mayúsculas");
    await menuPortal(page, "Mi Deuda");
    await page.getByText("Pagos anteriores").first().waitFor({ timeout: 15000 });
    const href = await page.locator('a[href*="/comprobante"]').first().getAttribute("href");
    const pdf = await page.request.get(href);
    exigir(pdf.ok() && pdf.headers()["content-type"].includes("pdf"), `el comprobante no bajó como PDF (${pdf.status()})`);
    await menuPortal(page, "Tickets");
    await page.locator("#ticket-categoria").selectOption({ index: 1 });
    await page.locator("#ticket-descripcion").fill("Prueba automática: el internet se corta todas las tardes.");
    await page.getByRole("button", { name: "Enviar solicitud" }).click();
    await page.getByText("Solicitud registrada. Código de seguimiento").waitFor({ timeout: 15000 });
    await esperarCorreo(`to:"${await correoDe(rutBD)}" subject:"Solicitud de soporte"`);
    await menuPortal(page, "Mis Servicios");
    const clave = `Prueba${nombre === "Camila" ? "Rojas" : "Gonzalez"}2026`;
    await page.getByLabel(/^Nueva contraseña/).fill(clave);
    await page.getByLabel(/Repite la nueva contraseña/).fill(clave);
    await page.getByRole("button", { name: "Solicitar cambio" }).click();
    await page.getByText("Solicitud registrada").first().waitFor({ timeout: 20000 });
    exigir(leerLog("g3").includes(`«${clave}»`), "el G3 simulado no recibió la clave");
  });
}

// Webpay: el portal crea el pago y lleva al sandbox de Transbank (necesita
// internet). El pago dentro de Transbank se prueba a mano: Transbank rechaza
// los navegadores automáticos («Your transaction couldn't go through»), y no
// se le disfraza el navegador. A mano funciona (15-11: dos pagos con su correo).
for (const [prefijo, rut, marca, nombre] of [
  ["", "16.234.567-2", "finet", "Camila"],
  ["/cable-magico", "18.567.890-3", "cable-magico", "Matías"],
]) {
  await flujo(`Pago (${nombre}, ${marca}): el portal crea el pago y lleva a Webpay (el pago en Transbank, a mano)`, async () => {
    const page = await nuevaPagina();
    await entrar(page, prefijo, rut);
    await menuPortal(page, "Mi Deuda");
    await page.getByRole("button", { name: "Pagar ahora" }).first().click();
    await page.waitForURL(/\/pagar/, { timeout: 20000 });
    await esperar(1500);
    exigir((await marcaDe(page)) === marca, `el pago se abrió como ${await marcaDe(page)}`);
    await page.locator('input[name="factura"]').first().check();
    if (await page.locator('input[name="medio"]').count()) await page.locator('input[name="medio"]').first().check();
    await page.getByRole("button", { name: "Pagar", exact: true }).click();
    await page.waitForURL(/webpay3gint\.transbank\.cl/, { timeout: 40000 });
  });
}

for (const [prefijo, rut, rutBD, marca, nombre] of [
  ["", "22.456.789-8", "22456789-8", "finet", "Ignacio"],
  ["/cable-magico", "19.678.901-4", "19678901-4", "cable-magico", "Valentina"],
]) {
  await flujo(`Registro de ${nombre} (${marca}): enlace por correo, contraseña y portal de su empresa`, async () => {
    const page = await nuevaPagina();
    await registrarse(page, prefijo, rut, await correoDe(rutBD));
    exigir((await marcaDe(page)) === marca && rutaDe(page) === `${prefijo}/portal`, `quedó en ${rutaDe(page)}`);
    await page.getByText(`Bienvenido, ${nombre}`).first().waitFor({ timeout: 15000 });
  });
}

async function registrarse(page, prefijo, rut, correo) {
  await borrarCorreos();
  await abrir(page, `${prefijo || "/finet"}/inicio-sesion`);
  await page.getByRole("button", { name: "Registrarse", exact: true }).click();
  await page.getByLabel(/RUT/i).first().fill(rut);
  await page.locator('button[type="submit"]').first().click();
  await page.getByText("Revisa tu correo").first().waitFor({ timeout: 15000 });
  const [m] = await esperarCorreo(`to:"${correo}" subject:"Crea tu cuenta"`);
  await page.goto(enlaceDe((await detalleCorreo(m.ID)).Text, "registro/confirmar"), { waitUntil: "load" });
  await page.locator('input[type="password"]').first().waitFor();
  await esperar(1500);
  for (const campo of await page.locator('input[type="password"]').all()) await campo.fill(CLAVE);
  await page.getByRole("checkbox").last().check();
  await page.locator('button[type="submit"]').first().click();
  await page.waitForURL(/\/portal/, { timeout: 20000 });
  await esperar(1000);
}

for (const [prefijo, plan, rut, rutBD, nombre, correo, region, comuna, marca] of [
  ["", 2, "20.123.456-5", "20123456-5", "Javiera Morales Castro", "javiera.morales@finet-demo.test",
    "Metropolitana de Santiago", "La Pintana", "finet"],
  ["/cable-magico", 7, "21.234.567-9", "21234567-9", "Tomás Herrera Díaz", "tomas.herrera@cable-demo.test",
    "Valparaíso", "Algarrobo", "cable-magico"],
]) {
  await flujo(`Contratar → aceptar la solicitud → registrarse (${marca})`, async () => {
    const page = await nuevaPagina();
    await abrir(page, `${prefijo}/contratar/${plan}`);
    await page.locator("#nombreCompleto").fill(nombre);
    await page.locator("#rut").fill(rut);
    await page.locator("#correoElectronico").fill(correo);
    await page.locator("#telefonoMovil").fill("987654321");
    await page.locator("#calleNumero").fill("Pasaje Los Aromos 1234");
    await page.locator("#region").selectOption({ label: region });
    await page.locator("#comuna").selectOption({ label: comuna });
    await page.getByRole("checkbox").last().check();
    await page.locator('button[type="submit"]').click();
    await page.getByText("Solicitud enviada").first().waitFor({ timeout: 15000 });
    correr("aceptar-prospecto.sh", [rut]);
    const cliente = await consulta("SELECT id_empresa FROM cliente WHERE rut = $1", [rutBD]);
    exigir(cliente.length === 1, "aceptar-prospecto no creó el cliente");
    await registrarse(page, prefijo, rut, correo);
    exigir((await marcaDe(page)) === marca, `quedó en ${await marcaDe(page)}`);
    await page.getByText(`Bienvenido, ${nombre.split(" ")[0]}`).first().waitFor({ timeout: 15000 });
  });
}

// El chatbot crea tickets solo para quien tiene la sesión iniciada en el portal
// (sin sesión responde, pero no reporta la falla).
await flujo("Chatbot con sesión (Camila): deuda, reportar una falla (ticket) y derivar a una persona", async () => {
  const page = await nuevaPagina();
  await entrar(page, "", "16.234.567-2");
  await page.getByRole("button", { name: "Abrir asistente virtual" }).click();
  const conversacion = page.getByRole("log").or(page.locator('[aria-label="Conversación"]')).first();
  async function decir(texto) {
    const antes = await conversacion.innerText();
    await page.getByLabel("Escribe tu mensaje").fill(texto);
    await page.getByRole("button", { name: "Enviar mensaje" }).click();
    let ultimo = "";
    let quieto = 0;
    for (let i = 0; i < 120 && quieto < 6; i++) {
      await esperar(500);
      const ahora = await conversacion.innerText();
      quieto = ahora === ultimo && ahora.length > antes.length + texto.length ? quieto + 1 : 0;
      ultimo = ahora;
    }
    return ultimo.slice(antes.length);
  }
  const ticketsAntes = await contarAuditoria("CREAR_TICKET_ASISTENTE");
  const derivacionesAntes = await contarAuditoria("ESCALAR_CONVERSACION_ASISTENTE");
  const deuda = await decir("Hola, mi RUT es 16.234.567-2. ¿Cuánto debo?");
  exigir(/\$\s?\d/.test(deuda), `el asistente no dio la deuda: «${deuda.slice(-200)}»`);
  await decir("Tengo una falla de internet: se corta todas las tardes desde ayer. Quiero reportarla.");
  // Antes de crear el ticket, el asistente pide la dirección de la falla y si
  // ya se reinició el router (y la categoría, por su nombre).
  for (let i = 0; i < 3 && (await contarAuditoria("CREAR_TICKET_ASISTENTE")) === ticketsAntes; i++) {
    await decir("La dirección es Avenida Santa Rosa 13050, La Pintana. Ya reinicié el router 30 segundos y sigue igual. Es una «Falla de Internet»: se corta todas las tardes desde ayer. Por favor crea el ticket.");
  }
  fs.writeFileSync(path.join(E2E, "chatbot.txt"), await conversacion.innerText());
  exigir((await contarAuditoria("CREAR_TICKET_ASISTENTE")) > ticketsAntes,
    `el asistente no creó el ticket (conversación en ${path.join(E2E, "chatbot.txt")})`);
  await decir("Quiero hablar con una persona, por favor.");
  for (let i = 0; i < 2 && (await contarAuditoria("ESCALAR_CONVERSACION_ASISTENTE")) === derivacionesAntes; i++) {
    await decir("Sí, deríveme con un ejecutivo humano.");
  }
  fs.writeFileSync(path.join(E2E, "chatbot.txt"), await conversacion.innerText());
  exigir((await contarAuditoria("ESCALAR_CONVERSACION_ASISTENTE")) > derivacionesAntes,
    `el asistente no derivó la conversación (conversación en ${path.join(E2E, "chatbot.txt")})`);
});

await flujo("Mi Perfil (Camila): celular sin +56, correo nuevo y contraseña nueva, y volver a entrar", async () => {
  const page = await nuevaPagina();
  await entrar(page, "", "16.234.567-2");
  await menuPortal(page, "Mi Perfil");
  await page.getByText("Mis Datos Personales").first().waitFor({ timeout: 15000 });
  const formulario = (campo) => page.locator("form").filter({ has: page.locator(campo) });
  const tel = formulario("#telefono");
  await tel.getByLabel("Contraseña actual").fill(CLAVE);
  await tel.locator("#telefono").fill("9 8765 4321");
  await tel.locator('button[type="submit"]').click();
  await page.getByText("Teléfono actualizado correctamente").first().waitFor({ timeout: 10000 });
  const correo = formulario("#email");
  await correo.getByLabel("Contraseña actual").fill(CLAVE);
  await correo.locator("#email").fill("camila.nueva@finet-demo.test");
  await correo.locator('button[type="submit"]').click();
  await esperar(2000);
  const [fila] = await consulta("SELECT telefono, email FROM cliente WHERE rut = '16234567-2'");
  exigir(fila.telefono === "+56987654321", `el celular quedó ${fila.telefono}`);
  exigir(fila.email === "camila.nueva@finet-demo.test", `el correo quedó ${fila.email}`);
  const clave = page.locator("form").filter({ has: page.getByLabel("Confirmar nueva contraseña") });
  await clave.getByLabel("Contraseña actual").fill(CLAVE);
  await clave.getByLabel("Nueva contraseña", { exact: true }).fill("Camila2026");
  await clave.getByLabel("Confirmar nueva contraseña").fill("Camila2026");
  await clave.locator('button[type="submit"]').click();
  await page.getByText("Contraseña actualizada correctamente").first().waitFor({ timeout: 10000 });
  await page.getByRole("button", { name: /Cerrar sesi/ }).filter({ visible: true }).first().click();
  await esperar(1500);
  await entrar(page, "", "16.234.567-2", "Camila2026");
});

await flujo("La demo sigue aislada: nada apunta a la VPS (verificar.sh)", async () => {
  const salida = correr("verificar.sh");
  exigir(salida.includes("Todo en orden"), salida.split("\n").filter((l) => l.includes("✗")).join(" | "));
});

// ─── Reporte ───────────────────────────────────────────────────────────────
await navegador.close();
await db.end();
const fallidos = resultados.filter((r) => !r.ok);
const lineas = [
  `# Prueba de la demo local (${new Date().toLocaleString("es-CL")})`,
  "",
  `${resultados.length - fallidos.length} de ${resultados.length} flujos bien.`,
  "",
  ...resultados.map((r) => `- ${r.ok ? "✓" : "✗"} ${r.nombre} (${r.s} s)${r.ok ? "" : `\n  - ${r.error}`}`),
];
fs.writeFileSync(path.join(E2E, "reporte.md"), `${lineas.join("\n")}\n`);
console.log(`\n${resultados.length - fallidos.length} de ${resultados.length} flujos bien. Reporte: ${path.join(E2E, "reporte.md")}`);
if (fallidos.length) console.log(`Capturas de las fallas: ${CAPTURAS}`);
process.exit(fallidos.length ? 1 : 0);
