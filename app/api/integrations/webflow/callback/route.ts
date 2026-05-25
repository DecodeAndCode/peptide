import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveWebflowIntegration } from "@/lib/integrations";

const WEBFLOW_TOKEN_URL = "https://api.webflow.com/oauth/access_token";

interface WebflowTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  token_type?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const code = searchParams.get("code");
  const state = searchParams.get("state");

  const cookieStore = cookies();
  const savedState = cookieStore.get("webflow_oauth_state")?.value;
  const from = cookieStore.get("webflow_oauth_from")?.value ?? "settings";
  cookieStore.set("webflow_oauth_state", "", { maxAge: 0, path: "/" });
  cookieStore.set("webflow_oauth_from", "", { maxAge: 0, path: "/" });

  const dest = from === "onboarding" ? "/onboarding" : "/settings";
  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}${dest}?error=webflow_auth_failed`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  const clientId = process.env.WEBFLOW_OAUTH_CLIENT_ID;
  const clientSecret = process.env.WEBFLOW_OAUTH_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}${dest}?error=webflow_not_configured`);
  }

  let tokenData: WebflowTokenResponse;
  try {
    const res = await fetch(WEBFLOW_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        grant_type: "authorization_code",
        client_id: clientId,
        client_secret: clientSecret,
        code,
        redirect_uri: `${appUrl}/api/integrations/webflow/callback`,
      }),
    });
    tokenData = (await res.json()) as WebflowTokenResponse;
  } catch {
    return NextResponse.redirect(`${appUrl}${dest}?error=webflow_token_exchange_failed`);
  }

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}${dest}?error=webflow_token_missing`);
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.redirect(`${appUrl}/onboarding`);
  }

  try {
    await saveWebflowIntegration({
      brandId: brand.id,
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token ?? null,
      expiresIn: tokenData.expires_in ?? null,
    });
  } catch {
    return NextResponse.redirect(`${appUrl}${dest}?error=webflow_save_failed`);
  }

  return NextResponse.redirect(`${appUrl}${dest}?webflow=connected`);
}
