import { NextResponse } from "next/server";
import { z } from "zod";
import { analyzeSite } from "@/lib/analysis/site-crawler";
import { enforceSameOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";
export const maxDuration = 120;

const analyzeSiteSchema = z.object({
  brandName: z.string().trim().min(2).max(120),
  websiteUrl: z.url(),
  industryTags: z.array(z.string().trim().min(1)).min(1).max(12),
});

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

  const body = await request.json().catch(() => null);
  const parsed = analyzeSiteSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid site analysis request." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Complete brand setup before analysis." }, { status: 400 });
  }

  try {
    const analysis = await analyzeSite(
      parsed.data.websiteUrl,
      parsed.data.industryTags,
      parsed.data.brandName,
    );
    const { data, error } = await supabase
      .from("site_analyses")
      .insert({
        brand_id: brand.id,
        pages_analyzed: analysis.pagesAnalyzed,
        has_llms_txt: analysis.hasLlmsTxt,
        llms_txt_content: analysis.llmsTxtContent,
        has_schema_markup: analysis.hasSchemaMarkup,
        javascript_rendering_issues: analysis.javascriptRenderingIssues,
        content_signals: analysis.contentSignals,
        missing_content_gaps: analysis.missingContentGaps,
        recommendations: analysis.recommendations,
      })
      .select("*")
      .single();

    if (error || !data) {
      console.error("[analyze-site] supabase insert failed:", error);
      return NextResponse.json({ error: "Unable to store site analysis." }, { status: 500 });
    }

    return NextResponse.json({
      summary: {
        pagesAnalyzed: data.pages_analyzed,
        topicCount: Array.isArray(data.content_signals?.topicKeywords)
          ? data.content_signals.topicKeywords.length
          : 0,
        contentGapCount: Array.isArray(data.missing_content_gaps) ? data.missing_content_gaps.length : 0,
      },
      analysis: data,
    });
  } catch (err) {
    console.error("[analyze-site] analyzeSite threw:", err);
    return NextResponse.json(
      { error: "We couldn't analyze the site right now. Please retry in a moment." },
      { status: 500 },
    );
  }
}
