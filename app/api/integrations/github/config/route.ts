import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { updateGitHubConfig } from "@/lib/integrations";
import { enforceSameOrigin } from "@/lib/security";

const configSchema = z.object({
  repo_full_name: z.string().min(1, "Repository is required."),
  content_dir: z.string().default(""),
});

export async function PATCH(request: Request) {
  const sameOriginError = enforceSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
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

  try {
    await updateGitHubConfig(brand.id, parsed.data.repo_full_name, parsed.data.content_dir);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to update config.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
