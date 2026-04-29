import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const dest = from === "onboarding" ? "/onboarding" : "/settings";
  const clientId = process.env.WEBFLOW_OAUTH_CLIENT_ID;

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}${dest}?error=webflow_not_configured`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = cookies();
  cookieStore.set("webflow_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  if (from) {
    cookieStore.set("webflow_oauth_from", from, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  const params = new URLSearchParams({
    response_type: "code",
    client_id: clientId,
    redirect_uri: `${appUrl}/api/integrations/webflow/callback`,
    scope: "sites:read cms:read cms:write",
    state,
  });

  return NextResponse.redirect(`https://webflow.com/oauth/authorize?${params.toString()}`);
}
