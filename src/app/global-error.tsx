"use client";

/**
 * Last-resort boundary, for a failure in the root layout itself.
 *
 * It replaces the whole document, so it must render its own <html> and <body>
 * and cannot use anything from the design system — the layout that provides
 * the stylesheet is exactly what failed. Styles are therefore inline.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en-IN">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "2rem",
          background: "#f8fafc",
          color: "#0f172a",
          fontFamily:
            'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Arial, sans-serif',
        }}
      >
        <main style={{ maxWidth: "32rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.25rem", fontWeight: 600, margin: 0 }}>
            The application failed to start
          </h1>
          <p style={{ marginTop: "0.75rem", fontSize: "0.875rem", color: "#475569" }}>
            This is a failure in the application shell rather than in one page. Trying again is
            worth one attempt; after that the reference below identifies it in the server log.
          </p>
          {error.digest && (
            <p
              style={{
                marginTop: "1rem",
                fontFamily: "ui-monospace, monospace",
                fontSize: "0.75rem",
                color: "#475569",
                background: "#e2e8f0",
                borderRadius: "0.375rem",
                padding: "0.5rem 0.75rem",
              }}
            >
              Reference: {error.digest}
            </p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "1.5rem",
              border: 0,
              borderRadius: "0.5rem",
              background: "#115664",
              color: "#fff",
              padding: "0.625rem 1.25rem",
              fontSize: "0.875rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
