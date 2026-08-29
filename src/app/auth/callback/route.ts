import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * OAuth, email-confirmation and password-recovery callback.
 *
 * The app asks for 6-digit codes rather than links, but the links in Supabase's
 * default email templates still arrive here — somebody who clicks the link
 * instead of copying the code must not hit a dead end. A recovery link lands on
 * /account/password with a session already established, which is why that page
 * exists for signed-in users rather than only inside a role's workspace.
 *
 * The `next` parameter is attacker-controllable, so it is only honoured when it
 * is a same-site absolute path — and never a protocol-relative one, which a
 * browser reads as another origin. Anything else falls back to /dashboard,
 * closing the open redirect that would otherwise let a phishing link bounce a
 * freshly authenticated user off-site.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const nextParam = searchParams.get("next");
  const next = nextParam && /^\/(?!\/)/.test(nextParam) ? nextParam : "/dashboard";
  // Supabase names the flow in the link. A recovery link must land on the
  // change-password page whatever `next` says, or the visitor is dropped into a
  // dashboard with no idea their password is still the one they forgot.
  const type = searchParams.get("type");
  const destination = type === "recovery" ? "/account/password" : next;

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`);
  }

  return NextResponse.redirect(`${origin}${destination}`);
}
