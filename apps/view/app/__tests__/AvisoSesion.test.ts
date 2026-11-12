/**
 * @jest-environment node
 */
import { NextRequest } from "next/server";
import { SignJWT } from "jose";
import { proxy } from "@/proxy";
import { MARCAS } from "@/app/_lib/company";
import { COOKIE_HAY_SESION } from "@/app/_lib/aviso-sesion";

/**
 * Sin sesión, el navegador no tiene por qué preguntarle al backend por el
 * perfil: la respuesta es un 401 que la consola marca como error (captura de
 * Emilio, 11-11). El proxy ya verifica el token en cada página, así que deja
 * un aviso sin secreto (`hay_sesion`) que el AuthProvider lee antes de
 * preguntar. El aviso no da acceso a nada: el backend sigue decidiendo.
 */
const ORIGEN = MARCAS.finet.url;

async function token(datos: Record<string, unknown> = { id_empresa: 1 }, clave?: string) {
  return new SignJWT({ sub: "1", type: "access", ...datos })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("1h")
    .sign(new TextEncoder().encode(clave ?? process.env.JWT_SECRET!));
}

function pedir(ruta: string, cookies: Record<string, string> = {}) {
  const cookie = Object.entries(cookies)
    .map(([k, v]) => `${k}=${v}`)
    .join("; ");
  return new NextRequest(new URL(ruta, ORIGEN), {
    headers: { host: new URL(ORIGEN).host, ...(cookie ? { cookie } : {}) },
  });
}

/** El Set-Cookie del aviso: "1", "borrar" o null si no lo toca. */
function aviso(respuesta: Response): "1" | "borrar" | null {
  const linea = respuesta.headers
    .getSetCookie()
    .find((c) => c.startsWith(`${COOKIE_HAY_SESION}=`));
  if (!linea) return null;
  return linea.startsWith(`${COOKIE_HAY_SESION}=1`) ? "1" : "borrar";
}

describe("aviso de sesión en el proxy", () => {
  it("con una sesión válida, deja el aviso", async () => {
    const r = await proxy(pedir("/planes", { access_token: await token() }));
    expect(aviso(r)).toBe("1");
  });

  it("el aviso se lee desde el navegador y no lleva nada de la sesión", async () => {
    const r = await proxy(pedir("/planes", { access_token: await token() }));
    const linea = r.headers.getSetCookie().find((c) => c.startsWith(`${COOKIE_HAY_SESION}=`))!;
    expect(linea).not.toMatch(/HttpOnly/i);
    expect(linea).toMatch(/SameSite=lax/i);
    expect(linea).toMatch(/Path=\//);
  });

  it("sin sesión no lo pone", async () => {
    expect(aviso(await proxy(pedir("/inicio-sesion")))).toBeNull();
  });

  it("sin sesión, uno que quedó de antes se borra", async () => {
    const r = await proxy(pedir("/inicio-sesion", { [COOKIE_HAY_SESION]: "1" }));
    expect(aviso(r)).toBe("borrar");
  });

  it("con un token que no es válido, se borra", async () => {
    const malo = await token({ id_empresa: 1 }, "otra-clave-que-no-es-la-del-portal-xx");
    const r = await proxy(pedir("/planes", { access_token: malo, [COOKIE_HAY_SESION]: "1" }));
    expect(aviso(r)).toBe("borrar");
  });

  it("al mandar al login por sesión vencida, también se borra", async () => {
    const malo = await token({ id_empresa: 1 }, "otra-clave-que-no-es-la-del-portal-xx");
    const r = await proxy(pedir("/portal", { access_token: malo, [COOKIE_HAY_SESION]: "1" }));
    expect(r.headers.get("location")).toContain("/inicio-sesion");
    expect(aviso(r)).toBe("borrar");
  });
});
