let accessToken: string | null = null;
let refreshInFlight: Promise<string | null> | null = null;

export class ApiError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function getAccessToken() {
  return accessToken;
}

export function setAccessToken(token: string | null) {
  accessToken = token;
}

function buildHeaders(init: RequestInit): Headers {
  const headers = new Headers(init.headers);
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  if (accessToken) {
    headers.set("authorization", `Bearer ${accessToken}`);
  }
  return headers;
}

async function parseResponse(res: Response) {
  let body: any = null;
  try {
    body = await res.json();
  } catch {
    body = null;
  }

  if (!res.ok || body?.success === false) {
    throw new ApiError(res.status, body?.message || `Request failed (${res.status})`);
  }

  return body;
}

export async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const res = await fetch("/api/auth/refresh", {
          method: "POST",
          credentials: "include",
        });
        if (!res.ok) return null;
        const body = await res.json();
        accessToken = body?.data?.accessToken ?? null;
        return accessToken;
      } catch {
        return null;
      } finally {
        queueMicrotask(() => {
          refreshInFlight = null;
        });
      }
    })();
  }
  return refreshInFlight;
}

const NEVER_REFRESH_PATHS = ["/api/auth/login", "/api/auth/refresh", "/api/auth/logout"];

export async function api<T = any>(
  path: string,
  init: RequestInit = {},
  allowRefreshRetry = true
): Promise<T> {
  const res = await fetch(path, {
    ...init,
    headers: buildHeaders(init),
    credentials: "include",
  });

  if (res.status === 401 && allowRefreshRetry && !NEVER_REFRESH_PATHS.some((p) => path.startsWith(p))) {
    const newToken = await refreshAccessToken();
    if (newToken) {
      return api<T>(path, init, false);
    }
  }

  return parseResponse(res) as Promise<T>;
}

export function apiPost<T = any>(path: string, payload?: unknown): Promise<T> {
  return api<T>(path, {
    method: "POST",
    body: payload === undefined ? undefined : JSON.stringify(payload),
  });
}
