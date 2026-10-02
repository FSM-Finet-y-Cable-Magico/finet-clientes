import { securityLogger } from "../_lib/logger";

export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api";

type ApiError = {
  message: string;
  status: number;
};

async function request<T>(
  path: string,
  options?: RequestInit
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
    ...options,
  });

  if (!res.ok) {
    let message: string;
    try {
      const body = await res.json();
      message = body.message ?? body.error ?? `Error ${res.status}`;
    } catch {
      message = `Error ${res.status}`;
    }

    if (res.status === 401) {
      securityLogger.unauthorized(path);

      if (
        !path.startsWith("/auth/login") &&
        !path.startsWith("/auth/perfil") &&
        typeof window !== "undefined"
      ) {
        window.dispatchEvent(new CustomEvent("auth:session-expired"));
      }
    } else if (res.status >= 400) {
      securityLogger.apiError(path, res.status, message);
    }

    throw { message, status: res.status } as ApiError;
  }

  return res.json();
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body ? JSON.stringify(body) : undefined,
    }),
  put: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PUT",
      body: body ? JSON.stringify(body) : undefined,
    }),
  patch: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined,
    }),
  delete: <T>(path: string) =>
    request<T>(path, { method: "DELETE" }),
};

export type { ApiError };
