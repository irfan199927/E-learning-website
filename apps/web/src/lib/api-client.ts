"use client";

/** Typed fetch for our own /api/v1 endpoints. Unwraps `{ data }` and turns problem+json into ApiError. */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly fieldErrors: { path: string; message: string }[] = [],
  ) {
    super(message);
  }
}

export async function api<T>(path: string, init: RequestInit & { json?: unknown } = {}): Promise<T> {
  const { json, headers, ...rest } = init;
  const res = await fetch(path, {
    ...rest,
    headers: { ...(json !== undefined ? { "content-type": "application/json" } : {}), ...headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
    credentials: "same-origin",
  });
  if (res.status === 204) return undefined as T;
  const payload = await res.json().catch(() => null);
  if (!res.ok) {
    throw new ApiError(
      res.status,
      payload?.code ?? "HTTP_ERROR",
      payload?.title ?? `Request failed (${res.status})`,
      payload?.errors ?? [],
    );
  }
  return payload?.data as T;
}
