# One hostname works, the other returns 500

Symptom: `https://www.getmespace.in` loads, `https://getmespace.in` shows a bare
`HTTP ERROR 500`. It reproduces on a fresh machine, so it is not a cache.

## This is not the application

Nothing in this codebase branches on the request host:

- `middleware.ts` never reads `host` — it looks at the pathname and the session.
- `next.config.ts` declares no redirects or rewrites, and its headers apply to
  `/:path*` regardless of host.
- There is no `vercel.json`.

One build cannot serve two behaviours for two hostnames. So whatever differs,
differs **before a request reaches the app** — in DNS, or in how the platform
routes that hostname.

## Establish where each host actually lands

Run both from your own machine. The headers name the cause.

```bash
curl -sS -o /dev/null -D - https://getmespace.in/
curl -sS -o /dev/null -D - https://www.getmespace.in/
```

Then compare what each host says about itself:

```bash
curl -s https://getmespace.in/api/v1/health     | python3 -m json.tool
curl -s https://www.getmespace.in/api/v1/health | python3 -m json.tool
```

The `deployment` block reports the host the request arrived on, the commit that
built the response, the branch and the environment.

### Reading the result

| What you see | What it means | Fix |
| --- | --- | --- |
| Apex 500s, health also 500s, no `x-vercel-id` header | The request never reached the platform. DNS points somewhere else. | Repoint the apex — below. |
| `x-vercel-error: DEPLOYMENT_NOT_FOUND` | DNS reaches Vercel, but no project claims this hostname. | Add the apex to the project's Domains. |
| Health returns JSON on **both**, with **different `commit` values** | The apex is pinned to an older deployment or a second project. | Below. |
| Health returns JSON on both with the same commit, but the page still 500s | Now it is worth looking at the app again — send me the two header dumps. | — |
| `x-vercel-error: FUNCTION_INVOCATION_FAILED` on the apex only | The apex is on a deployment whose environment variables differ. | Check that project's env vars. |

An older deployment is the likeliest of these, and it fits the history: before
the env-validation fix, a malformed `NEXT_PUBLIC_APP_URL` threw at module scope
and produced exactly this — a bare 500 with a tiny `text/plain` body, on every
route. A hostname still pointed at a build from before that fix would fail
exactly this way while `www`, on the current build, is fine.

## Repointing the apex

Vercel → the project → **Settings → Domains**.

1. Both `getmespace.in` and `www.getmespace.in` must be listed **on this
   project**. A domain can belong to only one project at a time; if the apex is
   on an old project, remove it there first.
2. Neither should be "Assigned to a specific deployment". That pins a hostname
   to one build forever, which is precisely how www and the apex drift apart.
   Both should follow the production branch.
3. Use the DNS records **the dashboard shows you** — it prints the exact A
   record for the apex and the CNAME for `www` for your account. Do not copy an
   IP from a blog post or from memory; Vercel has changed it.
4. Decide which is canonical and let Vercel redirect the other. Pick one — two
   live hostnames split SEO and make cookies behave oddly. `www` is the simpler
   choice with most DNS providers, because an apex cannot hold a real CNAME.
5. Wait for the certificate. A domain added minutes ago can serve errors until
   issuance completes.

Then check propagation from outside your own resolver:

```bash
dig +short getmespace.in
dig +short www.getmespace.in
dig +short getmespace.in @1.1.1.1
```

If the apex answer differs from what the dashboard asked for, the registrar
still has an old record — often a parking A record, or an ALIAS left behind by a
previous host.

## Once it is fixed

Set `NEXT_PUBLIC_APP_URL` to whichever hostname is canonical, and redeploy. It
is what canonical URLs, OG tags, the sitemap and the auth email redirects are
built from — and `/api/v1/health` reports it as `configuredUrl`, so you can
check it matches without redeploying to find out.
