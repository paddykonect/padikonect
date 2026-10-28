// Same-origin by default: calls go to the frontend's own origin and Next
// reverse-proxies /api/v1/* to the backend (see next.config.ts). This keeps the
// refresh cookie first-party so the session survives a reload on any host
// (localhost, LAN IP, prod domain). Override with NEXT_PUBLIC_API_BASE only for
// a genuinely cross-origin setup.
const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE ?? "/api/v1";

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

// Gateway errors (502/503/504) and network failures mean the request never
// reached the backend — safe to retry. On Render's free tier the backend sleeps
// after ~15 min idle and a cold start takes ~30-50s; retrying with backoff lets
// sign-in (and any call) ride out the wake-up instead of hard-failing.
const RETRY_STATUSES = new Set([502, 503, 504]);
const RETRY_DELAYS_MS = [800, 1500, 3000, 5000, 8000, 12000];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** Talks to the NestJS API, unwraps its {success,data}/{success:false,...} envelope (see backend's ResponseTransformInterceptor/AllExceptionsFilter). */
export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const canRetry = attempt < RETRY_DELAYS_MS.length;
    let res: Response;
    try {
      res = await fetch(`${API_BASE_URL}${path}`, {
        method: options.method ?? (options.body !== undefined ? "POST" : "GET"),
        headers: {
          ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
          ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
        },
        credentials: "include",
        body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      });
    } catch (err) {
      // Network error (server waking/unreachable) — retry, then give up.
      if (canRetry) {
        await sleep(RETRY_DELAYS_MS[attempt]);
        continue;
      }
      throw err;
    }

    // Transient gateway error — the backend is waking; back off and retry.
    if (RETRY_STATUSES.has(res.status) && canRetry) {
      await sleep(RETRY_DELAYS_MS[attempt]);
      continue;
    }

    const json = (await res.json().catch(() => null)) as SuccessEnvelope<T> | ErrorEnvelope | null;

    if (!res.ok || !json || !json.success) {
      const errJson = json as ErrorEnvelope | null;
      throw new ApiError(errJson?.code ?? "UNKNOWN_ERROR", errJson?.message ?? "Something went wrong. Please try again.", res.status, errJson?.params);
    }

    return json.data;
  }
}
