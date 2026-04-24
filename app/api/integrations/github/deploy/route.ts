import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import {
  getGitHubIntegration,
  getDecryptedAccessToken,
  recordContentDeployment,
} from "@/lib/integrations";
import { createContentPR } from "@/lib/github/pr-creator";
import { enforceSameOrigin } from "@/lib/security";
import type { GeneratedContentRecord, BrandRecord, CycleRecord } from "@/types";

const deploySchema = z.object({
  content_id: z.string().uuid("Invalid content ID."),
  // Optional overrides — if omitted, the integration's saved config is used
  repo_full_name: z.string().optional(),
  content_dir: z.string().optional(),
});

export async function POST(request: Request) {
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
  const parsed = deploySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

  // Fetch brand
  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  // Fetch integration
  const integration = await getGitHubIntegration(brand.id);
  if (!integration) {
    return NextResponse.json({ error: "GitHub is not connected. Connect it in Settings first." }, { status: 400 });
  }

  const repoFullName = parsed.data.repo_full_name ?? integration.credentials.repo_full_name;
  const contentDir = parsed.data.content_dir ?? integration.credentials.content_dir ?? "";

  if (!repoFullName) {
    return NextResponse.json(
      { error: "No repository configured. Set a repository in Settings > Connected Integrations first." },
      { status: 400 },
    );
  }

  // Fetch content record (verify it belongs to this brand)
  const { data: content } = await supabase
    .from("generated_content")
    .select("*")
    .eq("id", parsed.data.content_id)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (!content) {
    return NextResponse.json({ error: "Content not found." }, { status: 404 });
  }

  // Optionally fetch the cycle for PR context
  let cycle: CycleRecord | null = null;
  if ((content as GeneratedContentRecord).cycle_id) {
    const { data: cycleData } = await supabase
      .from("cycles")
      .select("*")
      .eq("id", (content as GeneratedContentRecord).cycle_id)
      .maybeSingle();
    cycle = (cycleData as CycleRecord | null) ?? null;
  }

  const accessToken = getDecryptedAccessToken(integration);

  try {
    const result = await createContentPR({
      accessToken,
      repoFullName,
      contentDir,
      content: content as GeneratedContentRecord,
      brand: brand as BrandRecord,
      cycle,
    });

    await recordContentDeployment({
      contentId: parsed.data.content_id,
      brandId: brand.id,
      integrationType: "github",
      externalUrl: result.pr_url,
      status: "deployed",
    });

    return NextResponse.json({
      ok: true,
      pr_url: result.pr_url,
      branch_name: result.branch_name,
      file_path: result.file_path,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to create GitHub PR.";

    // Record failed deployment attempt
    await recordContentDeployment({
      contentId: parsed.data.content_id,
      brandId: brand.id,
      integrationType: "github",
      externalUrl: "",
      status: "failed",
    }).catch(() => undefined);

    return NextResponse.json({ error: message }, { status: 502 });
  }
}
