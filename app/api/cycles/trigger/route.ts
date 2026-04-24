import { NextResponse } from "next/server";
import { runAnalysisCycle } from "@/lib/analysis/cycle-runner";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import type { BrandRecord, CycleRecord, SiteAnalysisRecord } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 300;

export async function POST(request: Request) {
  const sameOriginError = enforceSameOrigin(request);

  if (sameOriginError) {
    return sameOriginError;
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rateLimitError = await enforceRateLimit({
    request,
    bucket: "llm",
    userId: user.id,
  });

  if (rateLimitError) {
    return rateLimitError;
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrandRecord>();

  if (!brand) {
    return NextResponse.json({ error: "Complete onboarding before running a cycle." }, { status: 400 });
  }

  const [{ data: runningCycle }, { data: latestSiteAnalysis }] = await Promise.all([
    supabase
      .from("cycles")
      .select("id")
      .eq("brand_id", brand.id)
      .eq("status", "running")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle<Pick<CycleRecord, "id">>(),
    supabase
      .from("site_analyses")
      .select("*")
      .eq("brand_id", brand.id)
      .order("crawled_at", { ascending: false })
      .limit(1)
      .maybeSingle<SiteAnalysisRecord>(),
  ]);

  if (runningCycle) {
    return NextResponse.json(
      { error: "A cycle is already running. Wait for it to finish before starting another." },
      { status: 409 },
    );
  }

  if (!latestSiteAnalysis) {
    return NextResponse.json(
      { error: "Run site analysis during onboarding before triggering a cycle." },
      { status: 400 },
    );
  }

  try {
    const summary = await runAnalysisCycle({
      brand,
      siteAnalysis: latestSiteAnalysis,
    });

    return NextResponse.json({ cycle: summary });
  } catch (error) {
    console.error("[cycles/trigger]", {
      message: error instanceof Error ? error.message : "Unknown error",
      brandId: brand.id,
      userId: user.id,
      tier: brand.subscription_tier,
      hasSiteAnalysis: Boolean(latestSiteAnalysis?.id),
    });
    return NextResponse.json(
      { error: "We couldn't complete the analysis cycle right now. Please retry shortly." },
      { status: 500 },
    );
  }
}
