import { NextResponse } from "next/server";
import { runAnalysisCycle } from "@/lib/analysis/cycle-runner";
import { createServiceRoleClient } from "@/lib/supabase/service";
import type { BrandRecord, GeneratedContentRecord, SiteAnalysisRecord } from "@/types";

export const runtime = "nodejs";

export async function POST() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found." }, { status: 404 });
  }

  const supabase = createServiceRoleClient();
  const { data: starterBrand } = await supabase
    .from("brands")
    .select("*")
    .eq("onboarding_complete", true)
    .eq("subscription_tier", "starter")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrandRecord>();

  const { data: fallbackBrand } = starterBrand
    ? { data: starterBrand }
    : await supabase
        .from("brands")
        .select("*")
        .eq("onboarding_complete", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle<BrandRecord>();

  const brand = starterBrand ?? fallbackBrand;

  if (!brand) {
    return NextResponse.json(
      { error: "No onboarded brand was available for dev verification." },
      { status: 400 },
    );
  }

  const { data: siteAnalysis } = await supabase
    .from("site_analyses")
    .select("*")
    .eq("brand_id", brand.id)
    .order("crawled_at", { ascending: false })
    .limit(1)
    .maybeSingle<SiteAnalysisRecord>();

  if (!siteAnalysis) {
    return NextResponse.json(
      { error: "No site analysis exists for the selected verification brand." },
      { status: 400 },
    );
  }

  try {
    const summary = await runAnalysisCycle({
      brand,
      siteAnalysis,
      supabaseClient: supabase,
    });

    const { data: generatedContent } = await supabase
      .from("generated_content")
      .select("*")
      .eq("brand_id", brand.id)
      .eq("cycle_id", summary.cycleId)
      .order("created_at", { ascending: true })
      .returns<GeneratedContentRecord[]>();

    return NextResponse.json({
      cycle: summary,
      verification: {
        brandId: brand.id,
        tier: brand.subscription_tier,
        generatedContentCount: generatedContent?.length ?? 0,
        contentTypes: Array.from(new Set((generatedContent ?? []).map((item) => item.content_type))),
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Dev verification cycle failed." },
      { status: 500 },
    );
  }
}
