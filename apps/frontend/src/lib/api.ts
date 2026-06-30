import { getSession, clearSession } from "./auth";

export class ApiError extends Error {
  constructor(public data: { status_code: number; error: string; message: string; request_id?: string }) {
    super(data.message);
    this.name = "ApiError";
  }
}

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3001";

type JsonBody = Record<string, unknown> | undefined;

async function request(path: string, options: RequestInit = {}) {
  const session = getSession();

  const headers = new Headers(options.headers);
  if (session?.token) {
    headers.set("Authorization", `Bearer ${session.token}`);
  }

  // Skip Content-Type for multipart/form-data (fetch handles it)
  if (!(options.body instanceof FormData)) {
    headers.set("Content-Type", "application/json");
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  if (response.status === 401) {
    clearSession();
    window.location.href = "/login"; // Default redirect, layout guards handle specific roles
    throw new ApiError({
      status_code: 401,
      error: "Unauthorized",
      message: "Session expired. Please login again.",
    });
  }

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new ApiError({
      status_code: response.status,
      error: data.error || "API_ERROR",
      message: data.message || "An unexpected error occurred",
      request_id: data.request_id,
    });
  }

  return data;
}

export const api = {
  get: <T>(path: string, options?: RequestInit) =>
    request(path, { ...options, method: "GET" }).then(res => res as T),

  post: <T>(path: string, body?: JsonBody, options?: RequestInit) =>
    request(path, {
      ...options,
      method: "POST",
      body: body ? JSON.stringify(body) : undefined
    }).then(res => res as T),

  patch: <T>(path: string, body?: JsonBody, options?: RequestInit) =>
    request(path, {
      ...options,
      method: "PATCH",
      body: body ? JSON.stringify(body) : undefined
    }).then(res => res as T),

  upload: <T>(path: string, formData: FormData, options?: RequestInit) =>
    request(path, {
      ...options,
      method: "POST",
      body: formData
    }).then(res => res as T),
};
