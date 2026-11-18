import { readdirSync, readFileSync } from "node:fs";
import { join, sep } from "node:path";

const APP = join(__dirname, "..");

/**
 * Rama ppt: un enlace interno escrito tal cual («/privacidad») depende de la
 * empresa recordada en la cookie. En Cable Mágico precargaba la página de
 * Finet (404 en la consola) y podía llevar a la otra empresa. Se arman con
 * rutaMarca. Las listas de configuración (barra, pie, menú del portal) se
 * envuelven al dibujarse y no cuentan: no son atributos href de JSX.
 */
describe("enlaces internos con la empresa", () => {
  it("ningún href de JSX queda escrito sin la empresa", () => {
    const sueltos = readdirSync(APP, { recursive: true, encoding: "utf8" })
      .filter((a) => a.endsWith(".tsx") && !a.startsWith(`__tests__${sep}`))
      .flatMap((a) =>
        readFileSync(join(APP, a), "utf8")
          .split("\n")
          .flatMap((linea, i) =>
            /href=["']\/[a-z]/.test(linea) ? [`${a}:${i + 1}: ${linea.trim()}`] : [],
          ),
      );

    expect(sueltos).toEqual([]);
  });
});
