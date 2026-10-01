const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3000/api/v1";

export class ApiError extends Error {
  constructor(
    public code: string,
    message: string,
    public status: number,
    public params?: Record<string, unknown>,
  ) {
    super(message);
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown;
  accessToken?: string;
}

interface SuccessEnvelope<T> {
  success: true;
  data: T;
}
interface ErrorEnvelope {
  success: false;
  message: string;
  code: string;
  params?: Record<string, unknown>;
}

/** Talks to the NestJS API, unwraps its {success,data}/{success:false,...} envelope (see backend's ResponseTransformInterceptor/AllExceptionsFilter). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const res = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
    headers: {
      ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    credentials: "include",
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const json = (await res.json().catch(() => null)) as SuccessEnvelope<T> | ErrorEnvelope | null;

  if (!res.ok || !json || !json.success) {
    const errJson = json as ErrorEnvelope | null;
    throw new ApiError(errJson?.code ?? "UNKNOWN_ERROR", errJson?.message ?? "Something went wrong. Please try again.", res.status, errJson?.params);
  }

  return json.data;
}
