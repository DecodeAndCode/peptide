import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { randomBytes } from "crypto";

function getGitHubClientId(): string {
  const id = process.env.GITHUB_OAUTH_CLIENT_ID;
  if (!id) throw new Error("GITHUB_OAUTH_CLIENT_ID is not configured.");
  return id;
}

export async function GET(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  // CSRF state: random token bound to the user session
  const state = randomBytes(24).toString("hex");

  const cookieStore = cookies();
  cookieStore.set("github_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600, // 10 minutes
  });

  const params = new URLSearchParams({
    client_id: getGitHubClientId(),
    scope: "repo",
    state,
  });

  // Preserve where the user came from (onboarding vs settings)
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  if (from) {
    cookieStore.set("github_oauth_from", from, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
}
