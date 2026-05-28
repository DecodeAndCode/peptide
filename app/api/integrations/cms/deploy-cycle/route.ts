import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { enforceSameOrigin } from "@/lib/security";
import { deployCycleToWebflow } from "@/lib/webflow/cms-deployer";
import { isDryRunAllowedInProduction } from "@/lib/webflow/adapter";
import { deployCycleToShopify } from "@/lib/shopify/cms-deployer";
import type { BrandRecord, CmsDeploymentRunRecord, GeneratedContentRecord } from "@/types";

const deployCycleSchema = z.object({
  cycle_id: z.string().uuid("Invalid cycle ID."),
  provider: z.enum(["webflow", "shopify"]),
  dry_run: z.boolean().optional(),
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
  const parsed = deployCycleSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid input." }, { status: 400 });
  }

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

  const { data: cycle } = await supabase
    .from("cycles")
    .select("id")
    .eq("id", parsed.data.cycle_id)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (!cycle) {
    return NextResponse.json({ error: "Cycle not found." }, { status: 404 });
  }

  const { data: content } = await supabase
    .from("generated_content")
    .select("*")
    .eq("cycle_id", parsed.data.cycle_id)
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true });

  if (!content || content.length === 0) {
    return NextResponse.json({ error: "No generated content is available for this cycle." }, { status: 400 });
  }

  const dryRunRequested = parsed.data.dry_run === true;
  const dryRunPermitted =
    dryRunRequested && (process.env.NODE_ENV !== "production" || isDryRunAllowedInProduction());

  try {
    const deployArgs = {
      brand: brand as BrandRecord,
      cycleId: parsed.data.cycle_id,
      content: content as GeneratedContentRecord[],
      dryRun: dryRunPermitted,
    };
    let run: CmsDeploymentRunRecord;
    if (parsed.data.provider === "shopify") {
      run = await deployCycleToShopify(deployArgs);
    } else {
      run = await deployCycleToWebflow(deployArgs);
    }
    return NextResponse.json({ ok: run.status !== "failed", deployment: run });
  } catch (err) {
    const message = err instanceof Error ? err.message : "CMS deployment failed.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
