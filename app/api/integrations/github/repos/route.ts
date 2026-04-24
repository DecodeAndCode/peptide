import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGitHubIntegration, getDecryptedAccessToken } from "@/lib/integrations";
import { createGitHubClient } from "@/lib/github/client";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  const integration = await getGitHubIntegration(brand.id);
  if (!integration) {
    return NextResponse.json({ error: "GitHub not connected." }, { status: 400 });
  }

  const accessToken = getDecryptedAccessToken(integration);
  const octokit = createGitHubClient(accessToken);

  try {
    // Fetch up to 100 repos the user has access to, sorted by recently pushed
    const { data: repos } = await octokit.repos.listForAuthenticatedUser({
      per_page: 100,
      sort: "pushed",
    });

    const repoList = repos.map((r) => ({
      full_name: r.full_name,
      name: r.name,
      private: r.private,
      default_branch: r.default_branch,
    }));

    return NextResponse.json({ repos: repoList });
  } catch {
    return NextResponse.json({ error: "Failed to fetch repositories from GitHub." }, { status: 502 });
  }
}
