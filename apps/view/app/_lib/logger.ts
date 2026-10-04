import { seguimientoPermitido } from "./cookies-consentimiento";

type SecurityEvent =
  | "auth:login_failed"
  | "auth:session_expired"
  | "auth:token_invalid"
  | "api:unauthorized"
  | "api:error"
  | "page:error";

interface LogEntry {
  event: SecurityEvent;
  message: string;
  timestamp: string;
  details?: Record<string, unknown>;
}

function log(entry: LogEntry) {
  if (process.env.NODE_ENV === "development") {
    console.warn(
      `[SECURITY] ${entry.event} | ${entry.message}`,
      entry.details ?? "",
    );
    return;
  }

  const payload = {
    ...entry,
    environment: process.env.NODE_ENV,
    userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "",
    url: typeof window !== "undefined" ? window.location.href : "",
  };

  const SENTRY_DSN = process.env.NEXT_PUBLIC_SENTRY_DSN;
  if (!SENTRY_DSN) return;

  // CU-76 / RF-57: este es el unico envio de datos a un tercero que hace el
  // sitio, asi que es lo que el banner de cookies apaga. Sin consentimiento no
  // sale nada. Cualquier seguimiento que se agregue despues tiene que pasar por
  // la misma puerta.
  void seguimientoPermitido().then((permitido) => {
    if (!permitido) return;
    fetch("https://sentry.io/api/error", {
      method: "POST",
      body: JSON.stringify(payload),
      keepalive: true,
    }).catch(() => {});
  });
}

export const securityLogger = {
  loginFailed(rut: string, reason: string) {
    log({
      event: "auth:login_failed",
      message: `Login failed for RUT ending in ${rut.slice(-2)}`,
      timestamp: new Date().toISOString(),
      details: { reason },
    });
  },
  sessionExpired() {
    log({
      event: "auth:session_expired",
      message: "Session expired, redirecting to login",
      timestamp: new Date().toISOString(),
    });
  },
  tokenInvalid(pathname: string) {
    log({
      event: "auth:token_invalid",
      message: `Invalid token detected on ${pathname}`,
      timestamp: new Date().toISOString(),
      details: { pathname },
    });
  },
  unauthorized(path: string) {
    log({
      event: "api:unauthorized",
      message: `Unauthorized API access: ${path}`,
      timestamp: new Date().toISOString(),
      details: { path },
    });
  },
  apiError(path: string, status: number, message: string) {
    log({
      event: "api:error",
      message: `API error on ${path}`,
      timestamp: new Date().toISOString(),
      details: { path, status, message },
    });
  },
  pageError(pathname: string, error: unknown) {
    log({
      event: "page:error",
      message: `Page error on ${pathname}`,
      timestamp: new Date().toISOString(),
      details: { pathname, error: String(error) },
    });
  },
};
