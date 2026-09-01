# Email codes: how they are sent

The app asks people for **6-digit codes**, not links:

| Where | What it does |
| --- | --- |
| `/login` → *Email code* | Sign in without a password |
| `/register` | Confirm the address before the account is usable |
| `/forgot-password` | Prove the inbox, then set a new password |
| `/account/password` | Change a password with the current one (no email involved) |

**The app mints the codes and sends them itself, through Resend.** Supabase Auth
still owns accounts, passwords, sessions and the JWT that every row-level
security policy reads through `auth.uid()` — only email DELIVERY moved.

## Why delivery moved

Supabase's built-in SMTP is shared and rate-limited to a handful of messages an
hour. Fine while building; useless the moment real people sign up, when codes
simply stop arriving with nothing in the product to show why. The templates also
lived in a dashboard, which put the wording that greets a new customer outside
the repository and outside review.

`auth.admin.generateLink` is the hinge: it mints a real, verifiable one-time code
and returns it **without sending anything**. The app puts that code in its own
email (`src/lib/services/auth-email-template.ts`) and sends it through the
configured provider. Verification is unchanged — `auth.verifyOtp` — so sessions
and RLS carry on exactly as before.

## 1 · Configure Resend

```bash
EMAIL_PROVIDER="resend"
EMAIL_PROVIDER_API_KEY="re_..."          # Resend → API Keys
EMAIL_FROM="GetMeSpace <no-reply@getmespace.in>"
SUPABASE_SERVICE_ROLE_KEY="..."          # required to mint codes
```

Verify the sending domain in Resend first (DKIM, SPF and the return-path record
it gives you). An unverified domain either bounces or lands in spam, and a code
in a spam folder is indistinguishable from a code that was never sent.

`EMAIL_FROM` must use a domain you verified. `onboarding@resend.dev` works only
for sending to your own address and will fail for everybody else.

## 2 · Settings that still have to match

Authentication → **URL Configuration**:

- **Site URL** = `https://getmespace.in`
- **Redirect URLs** must include `https://getmespace.in/auth/callback`,
  `https://www.getmespace.in/auth/callback`, and
  `http://localhost:3000/auth/callback` for development.
- **OTP expiry**: one hour is the default and is what the emails say. Change one
  and change the other.

You no longer need to edit the Supabase email templates, and the "Confirm email"
toggle no longer decides whether an address gets verified — registration creates
the account unconfirmed and requires the code regardless. On a platform whose
premise is verification, that is not a setting worth inheriting from a checkbox.

## Fallback

If `SUPABASE_SERVICE_ROLE_KEY` or the Resend credentials are missing,
`canSendAuthCode()` is false and every flow falls back to letting Supabase send
its own email. A half-configured deployment degrades to the old behaviour rather
than to silence. In that mode the Supabase templates do matter, and they need
`{{ .Token }}` in **Confirm signup**, **Magic Link** and **Reset Password** for a
code to arrive at all.

Either way the links in Supabase's templates keep working through
`/auth/callback`, and a recovery link lands on `/account/password`.

## What the app does about abuse

Rate limits are enforced in the server actions, not left to the provider:

| Action | Per address | Per IP |
| --- | --- | --- |
| Send a code (login, signup resend, reset) | 5 / hour | 15 / hour |
| Spend a code | 10 / 15 min | 30 / 15 min |
| Change password while signed in | 5 / 15 min per account | |

Three properties these depend on, all deliberate:

- **Every send answers identically** — "If that email address has an account, a
  6-digit code is on its way" — whether or not the address is registered.
  Anything else turns the box into a membership oracle.
- **Code sign-in never creates an account.** Supabase's magiclink generation
  creates a user for an unknown address, so the app checks `profiles` first and
  simply sends nothing when there is no account. Without that check the sign-in
  box would be a sign-up box: accounts with no name, no phone, no role and no
  acceptance of the terms.
- **The lookup result never reaches the person asking.** It decides whether an
  email is sent; the response is the same either way.

Note that the in-memory rate limiter is per serverless instance. See
`src/lib/security/rate-limit.ts` — point it at Redis for a hard guarantee.

## Checking it works

Ask the deployment what it thinks it is doing:

```bash
curl -s https://getmespace.in/api/v1/health | python3 -m json.tool
```

The `email` block answers it outright:

```json
"email": {
  "provider": "resend",
  "configured": true,
  "deliversExternally": true,
  "authCodes": "sent_by_app"
}
```

| What you see | What it means |
| --- | --- |
| `provider: "console"` | `EMAIL_PROVIDER` is not `resend`. Unset, misspelled (`Resend` is not `resend`), or set on the wrong Vercel environment. Check `configWarnings` in the same response — validation names the variable when it rejected the value. |
| `configured: false` | `EMAIL_PROVIDER_API_KEY` or `EMAIL_FROM` is empty. |
| `authCodes: "supabase_fallback"` | Codes are being sent by Supabase, not by us — usually a missing `SUPABASE_SERVICE_ROLE_KEY`, since codes are minted with the admin API. |

**Environment variables only take effect on a new deployment**, and Vercel scopes
them per environment. A variable added to Preview does nothing in Production
until it is set there and the project is redeployed.

Then confirm end to end: register with an address you control. The account is
created unconfirmed, the code arrives from your Resend domain, and Resend's
dashboard shows the delivery. If it never arrives, look at Resend's log and at
the deployment's function log before suspecting the app — a refusal from Resend
(an unverified domain, a `from` that does not belong to it) is logged with the
provider's own explanation attached.
