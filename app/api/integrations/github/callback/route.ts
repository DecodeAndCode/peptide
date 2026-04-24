import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveGitHubIntegration } from "@/lib/integrations";

const GITHUB_TOKEN_URL = "https://github.com/login/oauth/access_token";

interface GitHubTokenResponse {
  access_token?: string;
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
  const savedState = cookieStore.get("github_oauth_state")?.value;
  const from = cookieStore.get("github_oauth_from")?.value ?? "settings";

  // Clear OAuth cookies
  cookieStore.set("github_oauth_state", "", { maxAge: 0, path: "/" });
  cookieStore.set("github_oauth_from", "", { maxAge: 0, path: "/" });

  if (!code || !state || !savedState || state !== savedState) {
    const dest = from === "onboarding" ? "/onboarding" : "/settings";
    return NextResponse.redirect(`${appUrl}${dest}?error=github_auth_failed`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  // Exchange code for access token
  const clientId = process.env.GITHUB_OAUTH_CLIENT_ID;
  const clientSecret = process.env.GITHUB_OAUTH_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    const dest = from === "onboarding" ? "/onboarding" : "/settings";
    return NextResponse.redirect(`${appUrl}${dest}?error=github_not_configured`);
  }

  let tokenData: GitHubTokenResponse;
  try {
    const res = await fetch(GITHUB_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    tokenData = (await res.json()) as GitHubTokenResponse;
  } catch {
    const dest = from === "onboarding" ? "/onboarding" : "/settings";
    return NextResponse.redirect(`${appUrl}${dest}?error=github_token_exchange_failed`);
  }

  if (!tokenData.access_token) {
    const dest = from === "onboarding" ? "/onboarding" : "/settings";
    return NextResponse.redirect(`${appUrl}${dest}?error=github_token_missing`);
  }

  // Look up the brand
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
    await saveGitHubIntegration(brand.id, tokenData.access_token);
  } catch {
    const dest = from === "onboarding" ? "/onboarding" : "/settings";
    return NextResponse.redirect(`${appUrl}${dest}?error=github_save_failed`);
  }

  // Redirect back to wherever the user came from, with success flag
  if (from === "onboarding") {
    return NextResponse.redirect(`${appUrl}/dashboard?github=connected`);
  }

  return NextResponse.redirect(`${appUrl}/settings?github=connected`);
}
