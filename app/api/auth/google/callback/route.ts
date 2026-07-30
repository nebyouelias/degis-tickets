import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db } from "@/lib/db";
import { createSession } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Step 2 of Google OAuth: Google redirects back here with a code.
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const storedState = cookies().get("degis_oauth_state")?.value;
  cookies().delete("degis_oauth_state");

  const fail = (reason: string) =>
    NextResponse.redirect(`${url.origin}/signin?error=${reason}`);

  if (!code || !state || !storedState || state !== storedState) {
    return fail("google");
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  if (!clientId || !clientSecret) return fail("config");

  // Exchange the code for tokens (server-to-server, over TLS)
  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${url.origin}/api/auth/google/callback`,
      grant_type: "authorization_code",
    }),
  });
  if (!tokenRes.ok) return fail("google");

  const tokens: { id_token?: string } = await tokenRes.json();
  if (!tokens.id_token) return fail("google");

  // The id_token came directly from Google's token endpoint over TLS,
  // so decoding its payload here is safe.
  const claims = JSON.parse(
    Buffer.from(tokens.id_token.split(".")[1], "base64url").toString()
  ) as { email?: string; email_verified?: boolean; name?: string };

  if (!claims.email || claims.email_verified === false) return fail("email");

  const email = claims.email.toLowerCase();
  const user = await db.user.upsert({
    where: { email },
    update: { name: claims.name ?? undefined },
    create: { email, name: claims.name ?? null },
  });

  await createSession(user.id);
  return NextResponse.redirect(`${url.origin}/account`);
}
