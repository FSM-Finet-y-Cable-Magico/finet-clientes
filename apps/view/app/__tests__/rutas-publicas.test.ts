import { readdirSync, readFileSync } from "node:fs";
import { join, relative, sep } from "node:path";
import {
  PREFIJOS_PRIVADOS,
  RUTA_PLAN,
  RUTAS_PUBLICAS,
  esIndexable,
} from "@/app/_lib/rutas-publicas";

const APP = join(__dirname, "..");

/** Rutas reales de app/, sacadas de sus page.tsx. */
function rutasDeApp(): string[] {
  return readdirSync(APP, { recursive: true, encoding: "utf8" })
    .filter((archivo) => archivo.split(sep).pop() === "page.tsx")
    .map((archivo) => {
      const segmentos = relative(APP, join(APP, archivo))
        .split(sep)
        .slice(0, -1)
        // Los grupos `(nombre)` no aparecen en la URL.
        .filter((segmento) => !/^\(.*\)$/.test(segmento));
      return `/${segmentos.join("/")}`;
    });
}

const esPrivada = (ruta: string) =>
  PREFIJOS_PRIVADOS.some((p) => ruta === p || ruta.startsWith(`${p}/`));

// CU-74: asi se detecta que cambiaron las rutas publicas del sitio.
describe("registro de rutas publicas (CU-74)", () => {
  it("declara cada pagina publica de app/", () => {
    const registradas = RUTAS_PUBLICAS.map((r) => r.path);
    const sinRegistrar = rutasDeApp().filter(
      (ruta) => !esPrivada(ruta) && !registradas.includes(ruta),
    );

    expect(sinRegistrar).toEqual([]);
  });

  it("no declara rutas que ya no existen", () => {
    const existentes = rutasDeApp();
    const huerfanas = RUTAS_PUBLICAS.map((r) => r.path).filter(
      (ruta) => !existentes.includes(ruta),
    );

    expect(huerfanas).toEqual([]);
  });

  // "Activa" es lo que el sitio muestra: una pagina que sigue existiendo pero
  // a la que ya no enlaza nada no debe ir al sitemap.
  it("solo manda al sitemap rutas enlazadas desde el sitio", () => {
    const enlazadas = new Set(
      readdirSync(APP, { recursive: true, encoding: "utf8" })
        .filter((a) => /\.tsx?$/.test(a) && !a.startsWith(`__tests__${sep}`))
        .flatMap((a) => [
          ...readFileSync(join(APP, a), "utf8").matchAll(
            /href(?:=|:\s*)["'`](\/[^"'`?#$]*)/g,
          ),
        ])
        .map((m) => m[1]),
    );
    const sinEnlace = RUTAS_PUBLICAS.filter(
      (r) => r.indexable && r.path !== RUTA_PLAN && !enlazadas.has(r.path),
    ).map((r) => r.path);

    expect(sinEnlace).toEqual([]);
  });

  it("no mezcla rutas privadas con publicas", () => {
    expect(RUTAS_PUBLICAS.filter((r) => esPrivada(r.path))).toEqual([]);
  });

  it("marca como no indexables solo las declaradas asi", () => {
    expect(esIndexable("/recuperar-password")).toBe(false);
    expect(esIndexable("/restablecer-password")).toBe(false);
    expect(esIndexable("/planes")).toBe(true);
    expect(esIndexable("/contratar/3")).toBe(true);
  });
});
