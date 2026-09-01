/**
 * Stands in for the `server-only` package under Vitest.
 *
 * `server-only` throws on import so that a server module pulled into a client
 * bundle fails the BUILD rather than leaking at runtime. That guard is worth
 * keeping, but it also makes every server module untestable, which is how the
 * provider registry — the thing that decides whether an email is actually sent
 * — ended up with no test at all.
 *
 * Aliasing it here restores testability without weakening the real build: the
 * alias exists only in vitest.config.mts.
 */
export {};
