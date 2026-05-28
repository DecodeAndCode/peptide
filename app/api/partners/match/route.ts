import { NextResponse } from "next/server";
import { generateCyclePartnerMatches } from "@/lib/partners/matcher";
import { enforceRateLimit, enforceSameOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import { getTierAnalysisConfig } from "@/lib/suppgo";
import type { BrandRecord, CycleRecord, PromptRecord, SiteAnalysisRecord } from "@/types";

export const runtime = "nodejs";
export const maxDuration = 120;

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
    return NextResponse.json({ error: "Complete onboarding before refreshing matches." }, { status: 400 });
  }

  const tierConfig = getTierAnalysisConfig(brand.subscription_tier);

  if (!tierConfig.influencerMatching) {
    return NextResponse.json({ error: "Partner matching is available on Pro only." }, { status: 403 });
  }

  const [{ data: cycle }, { data: siteAnalysis }] = await Promise.all([
    supabase
      .from("cycles")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("status", "complete")
      .order("completed_at", { ascending: false })
      .limit(1)
      .maybeSingle<CycleRecord>(),
    supabase
      .from("site_analyses")
      .select("*")
      .eq("brand_id", brand.id)
      .order("crawled_at", { ascending: false })
      .limit(1)
      .maybeSingle<SiteAnalysisRecord>(),
  ]);

  if (!cycle) {
    return NextResponse.json(
      { error: "Complete a cycle before refreshing partner matches." },
      { status: 400 },
    );
  }

  const { data: prompts } = await supabase
    .from("prompts")
    .select("*")
    .eq("cycle_id", cycle.id)
    .order("created_at", { ascending: true })
    .returns<PromptRecord[]>();

  try {
    const { matches, refreshNote } = await generateCyclePartnerMatches({
      brand,
      cycle,
      prompts: prompts ?? [],
      siteAnalysis: siteAnalysis ?? null,
    });

    return NextResponse.json({
      matches: {
        count: matches.length,
        top3Count: matches.slice(0, 3).length,
      },
      refreshNote,
    });
  } catch {
    return NextResponse.json(
      { error: "We couldn't refresh partner matches right now. Please retry shortly." },
      { status: 500 },
    );
  }
}
