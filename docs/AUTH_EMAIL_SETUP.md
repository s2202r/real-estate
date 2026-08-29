# Email codes: what Supabase has to be told

The app asks people for **6-digit codes**, not links:

| Where | What it does |
| --- | --- |
| `/login` → *Email code* | Sign in without a password |
| `/register` | Confirm the address before the account is usable |
| `/forgot-password` | Prove the inbox, then set a new password |
| `/account/password` | Change a password with the current one (no email involved) |

Supabase mints a token for every one of these. **Whether the token reaches the
person depends entirely on the email template**, and the stock templates print
only a link. Until the templates below carry `{{ .Token }}`, the code boxes in
the app will be waiting for a code that was never sent.

## 1 · Put the code in the templates

Supabase dashboard → **Authentication → Email Templates**. Three of them need
`{{ .Token }}`:

- **Confirm signup** — used by registration
- **Magic Link** — used by code sign-in
- **Reset Password** — used by the forgotten-password flow

Keep `{{ .ConfirmationURL }}` as well. The link still works: it lands on
`/auth/callback`, which establishes the session and — for a recovery link —
sends the visitor to `/account/password`. Someone who clicks instead of copying
must not hit a dead end.

A minimal body that serves both:

```html
<h2>Your {{ .SiteURL }} code</h2>
<p style="font-size:28px;letter-spacing:6px;font-weight:600">{{ .Token }}</p>
<p>It expires in an hour. If you did not ask for it, ignore this email.</p>
<p>Or <a href="{{ .ConfirmationURL }}">open this link</a> instead.</p>
```

## 2 · Settings that have to match

Authentication → **Providers → Email**, and **URL Configuration**:

- **Confirm email: ON.** With it off, `signUp` returns a session immediately,
  the app skips the verification step (correctly — there is nothing to verify),
  and unverified addresses reach the network. Verification is the product.
- **Site URL** = `https://getmespace.in` — where the links point.
- **Redirect URLs** must include `https://getmespace.in/auth/callback`,
  `https://www.getmespace.in/auth/callback`, and
  `http://localhost:3000/auth/callback` for development. A URL that is not on
  this list is rejected and the visitor lands on an error page.
- **OTP expiry**: one hour is the default and is what the app tells people.
  Change one and change the other.

## 3 · Use a real sender before launch

Supabase's built-in SMTP is rate-limited to a handful of messages an hour and is
shared. It is fine while you are building and useless the moment real people
sign up — codes simply stop arriving, with nothing in the app to show why.
Configure custom SMTP (Authentication → Emails → SMTP Settings) against
whatever sends your transactional mail.

## What the app does about abuse

Rate limits are enforced in the server actions, not left to Supabase:

| Action | Per address | Per IP |
| --- | --- | --- |
| Send a code (login, signup resend, reset) | 5 / hour | 15 / hour |
| Spend a code | 10 / 15 min | 30 / 15 min |
| Change password while signed in | 5 / 15 min per account | |

Two properties these depend on, both deliberate:

- **Every send answers identically** — "If that email address has an account, a
  6-digit code is on its way" — whether or not the address is registered.
  Anything else turns the box into a membership oracle.
- **Code sign-in never creates an account** (`shouldCreateUser: false`). With it
  on, typing any address into the sign-in box would produce an account with no
  name, no phone, no role and no acceptance of the terms.

Note that the in-memory rate limiter is per serverless instance. See
`src/lib/security/rate-limit.ts` — point it at Redis for a hard guarantee.
