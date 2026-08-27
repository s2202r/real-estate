import "server-only";

import { platformLimits } from "@/config/app";

/**
 * Rate limiting.
 *
 * The in-memory implementation below is correct for a single process and is
 * the DEVELOPMENT default. On Vercel, each serverless instance keeps its own
 * counter, so the effective limit is per-instance — fine as an abuse speed
 * bump, insufficient as a hard guarantee.
 *
 * `RateLimiter` is therefore an interface: point it at Upstash/Redis in
 * production by implementing `consume` and swapping the export. Callers do not
 * change.
 */

export interface RateLimitResult {
  readonly allowed: boolean;
  readonly remaining: number;
  readonly limit: number;
  /** Unix ms at which the current window resets. */
  readonly resetAt: number;
  readonly retryAfterSeconds: number;
}

export interface RateLimiter {
  consume(key: string, limit?: number, windowSeconds?: number): Promise<RateLimitResult>;
}

interface Bucket {
  count: number;
  resetAt: number;
}

class InMemoryRateLimiter implements RateLimiter {
  private readonly buckets = new Map<string, Bucket>();
  private lastSweep = 0;

  async consume(
    key: string,
    limit = platformLimits.rateLimitMaxRequests,
    windowSeconds = platformLimits.rateLimitWindowSeconds,
  ): Promise<RateLimitResult> {
    const now = Date.now();
    this.sweep(now);

    const existing = this.buckets.get(key);
    const bucket =
      existing && existing.resetAt > now
        ? existing
        : { count: 0, resetAt: now + windowSeconds * 1000 };

    bucket.count += 1;
    this.buckets.set(key, bucket);

    const allowed = bucket.count <= limit;
    return {
      allowed,
      remaining: Math.max(0, limit - bucket.count),
      limit,
      resetAt: bucket.resetAt,
      retryAfterSeconds: allowed ? 0 : Math.ceil((bucket.resetAt - now) / 1000),
    };
  }

  /** Drop expired buckets occasionally so the map cannot grow without bound. */
  private sweep(now: number): void {
    if (now - this.lastSweep < 60_000) return;
    this.lastSweep = now;
    for (const [key, bucket] of this.buckets) {
      if (bucket.resetAt <= now) this.buckets.delete(key);
    }
  }
}

let limiter: RateLimiter | null = null;

export function getRateLimiter(): RateLimiter {
  limiter ??= new InMemoryRateLimiter();
  return limiter;
}

/** Replace the limiter (production Redis adapter, or a test double). */
export function setRateLimiter(next: RateLimiter): void {
  limiter = next;
}

/**
 * Identify the caller for rate-limiting purposes.
 *
 * Prefers the authenticated user id, because an IP is shared behind CGNAT and
 * would otherwise let one abusive user throttle a whole city.
 */
export function rateLimitKey(
  scope: string,
  identity: { userId?: string | null; ip?: string | null },
): string {
  return `${scope}:${identity.userId ?? `ip:${identity.ip ?? "unknown"}`}`;
}

/** Best-effort client IP from proxy headers. */
export function clientIpFrom(headers: Headers): string | null {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0]?.trim() ?? null;
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip");
}

export class RateLimitError extends Error {
  readonly status = 429;
  constructor(readonly result: RateLimitResult) {
    super(`Rate limit exceeded. Try again in ${result.retryAfterSeconds}s.`);
    this.name = "RateLimitError";
  }
}
