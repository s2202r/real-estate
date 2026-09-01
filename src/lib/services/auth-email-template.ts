import { appConfig } from "@/config/app";

/**
 * The authentication email itself.
 *
 * Pure and free of `server-only` so it can be tested and previewed: the
 * wording somebody sees when they are locked out of their account deserves to
 * be pinned down by something other than hope.
 */

export type AuthCodePurpose = "signin" | "recovery";

export interface AuthEmailContent {
  readonly subject: string;
  readonly text: string;
  readonly html: string;
}

/**
 * The email itself.
 *
 * Written to be read in two seconds on a lock screen: the code is the first
 * thing after the greeting, large and spaced, and the reason for it is one
 * line. The "if you did not ask for this" sentence is not boilerplate — it is
 * the only warning a person gets that someone is trying to reach their account.
 *
 * Inline styles throughout, because email clients discard everything else.
 */
export function renderAuthEmail({
  code,
  purpose,
  name,
}: {
  code: string;
  purpose: AuthCodePurpose;
  name: string | null;
}): AuthEmailContent {
  const app = appConfig.name;
  const greeting = name ? `Hi ${name},` : "Hi,";

  const reason =
    purpose === "recovery"
      ? `Use this code to set a new password for your ${app} account.`
      : `Use this code to sign in to ${app}.`;

  const subject =
    purpose === "recovery" ? `${code} is your ${app} password reset code` : `${code} is your ${app} code`;

  const text = [
    greeting,
    "",
    reason,
    "",
    code,
    "",
    "It expires in an hour and can be used once.",
    "",
    `If you did not ask for this, you can ignore this email — nobody can get into your account with it alone. If it keeps happening, tell us at ${appConfig.supportEmail}.`,
    "",
    `— ${app}`,
  ].join("\n");

  const html = `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width">
<title>${escapeHtml(subject)}</title></head>
<body style="margin:0;padding:24px;background:#f6f7f6;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;color:#14201c">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:520px;margin:0 auto;background:#ffffff;border:1px solid #e4e8e6;border-radius:14px">
    <tr><td style="padding:32px">
      <p style="margin:0 0 4px;font-size:15px;font-weight:600;letter-spacing:-0.01em">${escapeHtml(app)}</p>
      <p style="margin:0 0 20px;font-size:15px;line-height:1.6">${escapeHtml(greeting)}</p>
      <p style="margin:0 0 18px;font-size:15px;line-height:1.6">${escapeHtml(reason)}</p>
      <p style="margin:0 0 18px;padding:18px 12px;background:#f2f5f4;border-radius:10px;text-align:center;
                font-family:ui-monospace,SFMono-Regular,Menlo,monospace;font-size:30px;font-weight:700;
                letter-spacing:0.28em;text-indent:0.28em;color:#0f2f28">${escapeHtml(code)}</p>
      <p style="margin:0 0 18px;font-size:13px;line-height:1.6;color:#5d6b66">
        It expires in an hour and can be used once.
      </p>
      <p style="margin:0;padding-top:18px;border-top:1px solid #e4e8e6;font-size:13px;line-height:1.6;color:#5d6b66">
        If you did not ask for this, you can ignore this email — nobody can get into your account with
        it alone. If it keeps happening, tell us at
        <a href="mailto:${escapeHtml(appConfig.supportEmail)}" style="color:#0f5f52">${escapeHtml(appConfig.supportEmail)}</a>.
      </p>
    </td></tr>
  </table>
</body></html>`;

  return { subject, text, html };
}

/**
 * The code comes from Supabase and the name from a profile, so neither is
 * attacker-controlled in any interesting way — but a name is user input that
 * ends up in markup, and escaping it is one line.
 */
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
