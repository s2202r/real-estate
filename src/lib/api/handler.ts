import "server-only";

import { NextResponse, type NextRequest } from "next/server";
import { z, type ZodType } from "zod";
import { getSessionUser, type SessionUser } from "@/lib/auth/session";
import { createAdminClient, isAdminClientAvailable } from "@/lib/supabase/admin";
import {
  clientIpFrom,
  getRateLimiter,
  rateLimitKey,
  type RateLimitResult,
} from "@/lib/security/rate-limit";
import { AuthenticationError, AuthorizationError, can, type Capability } from "@/lib/auth/permissions";

/**
 * API middleware for /api/v1.
 *
 * `withApi` gives every route the same behaviour, so a new endpoint cannot
 * accidentally omit a control:
 *
 *   - authentication resolution (and rejection when required)
 *   - capability checks
 *   - Zod validation of body and query
 *   - rate limiting, keyed by user rather than IP where possible
 *   - idempotency-key replay protection on unsafe methods
 *   - a shape-stable error envelope that never leaks SQL or stack traces
 *   - a request id on every response, for correlating logs with a report
 */

export interface ApiContext<TBody = unknown, TQuery = unknown> {
  readonly request: NextRequest;
  readonly user: SessionUser | null;
  readonly body: TBody;
  readonly query: TQuery;
  readonly requestId: string;
}

export interface ApiEnvelope<T> {
  readonly data: T;
  readonly meta?: Record<string, unknown>;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

interface WithApiOptions<TBody, TQuery> {
  /** Require an authenticated user. */
  readonly auth?: boolean;
  /** Require a capability (implies auth). */
  readonly capability?: Capability;
  readonly bodySchema?: ZodType<TBody>;
  readonly querySchema?: ZodType<TQuery>;
  readonly rateLimit?: { scope: string; limit: number; windowSeconds: number };
  /** Honour an Idempotency-Key header, replaying the stored response. */
  readonly idempotent?: boolean;
}

export function withApi<TBody = unknown, TQuery = unknown, TResult = unknown>(
  options: WithApiOptions<TBody, TQuery>,
  handler: (context: ApiContext<TBody, TQuery>) => Promise<ApiEnvelope<TResult>>,
) {
  return async (request: NextRequest): Promise<NextResponse> => {
    const requestId = crypto.randomUUID();

    try {
      const user = await getSessionUser();

      if ((options.auth || options.capability) && !user) {
        throw new AuthenticationError();
      }
      if (options.capability && user && !can(user, options.capability)) {
        throw new AuthorizationError(
          `This endpoint requires the "${options.capability}" capability.`,
        );
      }

      let limit: RateLimitResult | null = null;
      if (options.rateLimit) {
        limit = await getRateLimiter().consume(
          rateLimitKey(options.rateLimit.scope, {
            userId: user?.id,
            ip: clientIpFrom(request.headers),
          }),
          options.rateLimit.limit,
          options.rateLimit.windowSeconds,
        );
        if (!limit.allowed) {
          return errorResponse(
            new ApiError(429, "rate_limited", "Too many requests. Please slow down."),
            requestId,
            limit,
          );
        }
      }

      // Idempotency: replay the stored response rather than repeating a write.
      const idempotencyKey = request.headers.get("idempotency-key");
      if (options.idempotent && idempotencyKey && isAdminClientAvailable()) {
        const replay = await findIdempotentResponse(idempotencyKey);
        if (replay) {
          return NextResponse.json(replay.body, {
            status: replay.status,
            headers: { "x-request-id": requestId, "idempotent-replay": "true" },
          });
        }
      }

      const query = options.querySchema
        ? parseOrThrow(
            options.querySchema,
            Object.fromEntries(request.nextUrl.searchParams),
            "query",
          )
        : ({} as TQuery);

      const body = options.bodySchema
        ? parseOrThrow(options.bodySchema, await readJson(request), "body")
        : ({} as TBody);

      const result = await handler({ request, user, body, query, requestId });

      if (options.idempotent && idempotencyKey && user && isAdminClientAvailable()) {
        await storeIdempotentResponse(idempotencyKey, user.id, request.nextUrl.pathname, result);
      }

      return NextResponse.json(result, {
        status: 200,
        headers: rateLimitHeaders({ "x-request-id": requestId }, limit),
      });
    } catch (error) {
      return errorResponse(error, requestId, null);
    }
  };
}

function parseOrThrow<T>(schema: ZodType<T>, value: unknown, source: string): T {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    throw new ApiError(400, "invalid_request", `Invalid request ${source}.`, parsed.error.flatten());
  }
  return parsed.data;
}

async function readJson(request: NextRequest): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body must be valid JSON.");
  }
}

function errorResponse(
  error: unknown,
  requestId: string,
  limit: RateLimitResult | null,
): NextResponse {
  const headers = rateLimitHeaders({ "x-request-id": requestId }, limit);

  if (error instanceof ApiError) {
    return NextResponse.json(
      { error: { code: error.code, message: error.message, details: error.details } },
      { status: error.status, headers },
    );
  }

  if (error instanceof AuthenticationError) {
    return NextResponse.json(
      { error: { code: "unauthenticated", message: error.message } },
      { status: 401, headers },
    );
  }

  if (error instanceof AuthorizationError) {
    return NextResponse.json(
      { error: { code: "forbidden", message: error.message } },
      { status: 403, headers },
    );
  }

  // Anything else is unexpected. Log it against the request id and return a
  // generic message: internal errors must never leak SQL, table names or stack
  // traces to a caller.
  console.error(`[api:${requestId}]`, error);
  return NextResponse.json(
    { error: { code: "internal_error", message: "Something went wrong. Please try again." } },
    { status: 500, headers },
  );
}

function rateLimitHeaders(
  base: Record<string, string>,
  limit: RateLimitResult | null,
): Record<string, string> {
  if (!limit) return base;
  return {
    ...base,
    "x-ratelimit-limit": String(limit.limit),
    "x-ratelimit-remaining": String(limit.remaining),
    "x-ratelimit-reset": String(Math.ceil(limit.resetAt / 1000)),
    ...(limit.allowed ? {} : { "retry-after": String(limit.retryAfterSeconds) }),
  };
}

async function findIdempotentResponse(
  key: string,
): Promise<{ status: number; body: unknown } | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("idempotency_keys")
    .select("response_status, response_body, expires_at")
    .eq("key", key)
    .maybeSingle();

  if (!data?.response_status) return null;
  if (data.expires_at && new Date(data.expires_at) < new Date()) return null;

  return { status: data.response_status, body: data.response_body };
}

async function storeIdempotentResponse(
  key: string,
  userId: string,
  endpoint: string,
  body: unknown,
): Promise<void> {
  const admin = createAdminClient();
  await admin.from("idempotency_keys").upsert({
    key,
    user_id: userId,
    endpoint,
    request_hash: endpoint,
    response_status: 200,
    response_body: body as never,
  });
}

/** Shared pagination query schema. */
export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(1000).default(1),
  pageSize: z.coerce.number().int().min(1).max(50).default(20),
});
