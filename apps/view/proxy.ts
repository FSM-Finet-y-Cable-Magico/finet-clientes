import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { jwtVerify } from "jose";
import type { JWTPayload } from "jose";
import {
  esSlugMarca,
  MARCA_POR_DEFECTO,
  MARCAS,
  marcaPorEmpresa,
  marcaPorHost,
  marcaPorSlug,
  rutaMarca,
  separarMarca,
  type SlugMarca,
} from "./app/_lib/company";
import { COOKIE_MARCA, enrutarMarca } from "./app/_lib/enrutar-marca";
import { COOKIE_HAY_SESION } from "./app/_lib/aviso-sesion";

const PROTECTED_PATHS = ["/portal", "/perfil"];

const UN_ANIO_S = 60 * 60 * 24 * 365;

const JWT_SECRET = (() => {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error("JWT_SECRET environment variable is not set");
  }
  return new TextEncoder().encode(secret);
})();

async function verifyToken(token: string): Promise<JWTPayload | null> {
  try {
    const { payload } = await jwtVerify(token, JWT_SECRET, {
      algorithms: ["HS256"],
      clockTolerance: 30,
    });
    return payload;
  } catch {
    return null;
  }
}

/** La empresa del token firmado; un token anterior al 11-11 no la trae. */
function marcaDelToken(payload: JWTPayload | null): SlugMarca | null {
  const idEmpresa = payload?.id_empresa;
  return typeof idEmpresa === "number"
    ? (marcaPorEmpresa(idEmpresa).slug as SlugMarca)
    : null;
}

function alLogin(request: NextRequest, marca: SlugMarca, expirada: boolean) {
  const { pathname } = request.nextUrl;
  // El login del sitio de esa empresa.
  const loginUrl = new URL(
    rutaMarca(marcaPorSlug(marca), "/inicio-sesion"),
    request.url,
  );
  loginUrl.searchParams.set("redirect", pathname);
  if (expirada) loginUrl.searchParams.set("expired", "1");
  const response = NextResponse.redirect(loginUrl);
  if (expirada) response.cookies.delete("access_token");
  return response;
}

export async function proxy(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const token = request.cookies.get("access_token")?.value;
  const payload = token ? await verifyToken(token) : null;
  const cookie = request.cookies.get(COOKIE_MARCA)?.value;
  const host = marcaPorHost(request.headers.get("host"));
  const marcaToken = marcaDelToken(payload);

  // Con un host por empresa, la cookie de sesión es de este host. Una de un
  // cliente de la otra empresa no vale aquí: se borra y no manda a su sitio,
  // donde no hay sesión (si no, el visitante quedaba atrapado en ese host).
  const ajena =
    marcaToken !== null &&
    MARCAS[marcaToken].url !== (host ?? MARCA_POR_DEFECTO).url;
  // El aviso de sesión para el navegador (app/_lib/aviso-sesion.ts): sin él,
  // el AuthProvider no le pregunta al backend por el perfil.
  const sesionValida = payload !== null && !ajena;
  const ajustarSesion = <T extends NextResponse>(response: T): T => {
    if (ajena) response.cookies.delete("access_token");
    if (sesionValida && !request.cookies.has(COOKIE_HAY_SESION)) {
      response.cookies.set(COOKIE_HAY_SESION, "1", {
        path: "/",
        sameSite: "lax",
        secure: request.nextUrl.protocol === "https:",
      });
    } else if (!sesionValida && request.cookies.has(COOKIE_HAY_SESION)) {
      response.cookies.delete(COOKIE_HAY_SESION);
    }
    return response;
  };

  const decision = enrutarMarca({
    pathname,
    search,
    marcaToken: ajena ? null : marcaToken,
    marcaCookie: esSlugMarca(cookie) ? cookie : null,
    marcaHost: (host?.slug as SlugMarca) ?? null,
  });

  if (decision.tipo === "redirigir") {
    return ajustarSesion(NextResponse.redirect(new URL(decision.destino, request.url)));
  }

  // El portal y el perfil piden sesión, en el sitio de cualquier empresa.
  const { ruta } = separarMarca(pathname);
  const isProtected = PROTECTED_PATHS.some(
    (p) => ruta === p || ruta.startsWith(p + "/"),
  );
  if (isProtected && (!token || ajena)) {
    return ajustarSesion(alLogin(request, decision.marca, false));
  }
  if (isProtected && !payload) {
    return ajustarSesion(alLogin(request, decision.marca, true));
  }

  const response = ajustarSesion(
    NextResponse.rewrite(new URL(decision.destino, request.url)),
  );
  if (decision.guardarCookie) {
    response.cookies.set(COOKIE_MARCA, decision.guardarCookie, {
      path: "/",
      maxAge: UN_ANIO_S,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
    });
  }
  return response;
}

/**
 * Todas las páginas, menos lo que Next sirve solo y los archivos con extensión
 * (imágenes, favicon, sitemap.xml, robots.txt, manifest.json). Next 16 lee
 * `config`: con otro nombre el proxy correría también para `/_next/…`.
 */
export const config = {
  matcher: ["/((?!_next/static|_next/image|api/|.*\\.[A-Za-z0-9]+$).*)"],
};
