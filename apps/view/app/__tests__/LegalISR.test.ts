import { revalidate as revalidatePrivacidad } from "@/app/(legal)/privacidad/page";
import { revalidate as revalidateTerminos } from "@/app/(legal)/terminos/page";

/**
 * RNF-56.1: el contenido legal se sirve estático mediante ISR. Sin este test,
 * borrar el `export const revalidate` no rompe nada visible y la ruta vuelve a
 * ser estática pura sin que nadie se entere.
 */
describe("CU-73: las páginas legales se sirven con ISR", () => {
  it.each([
    ["/terminos", revalidateTerminos],
    ["/privacidad", revalidatePrivacidad],
  ])("%s declara un revalidate en segundos", (_ruta, revalidate) => {
    expect(typeof revalidate).toBe("number");
    expect(revalidate).toBeGreaterThan(0);
  });
});
