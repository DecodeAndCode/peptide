import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getGitHubIntegrationStatus } from "@/lib/integrations";

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

  const status = await getGitHubIntegrationStatus(brand.id);
  return NextResponse.json(status);
}
