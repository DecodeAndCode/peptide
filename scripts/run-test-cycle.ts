import fs from "node:fs";
import path from "node:path";
import type { BrandRecord, GeneratedContentRecord, SiteAnalysisRecord } from "@/types";

function loadEnvFile(filePath: string) {
  const contents = fs.readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    const separatorIndex = trimmed.indexOf("=");

    if (separatorIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));
  process.env.SUPPGO_TEST_MODE = "true";

  const [{ runAnalysisCycle }, { createServiceRoleClient }] = await Promise.all([
    import("@/lib/analysis/cycle-runner"),
    import("@/lib/supabase/service"),
  ]);

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
    throw new Error("No onboarded brand found for test-cycle verification.");
  }

  const { data: siteAnalysis } = await supabase
    .from("site_analyses")
    .select("*")
    .eq("brand_id", brand.id)
    .order("crawled_at", { ascending: false })
    .limit(1)
    .maybeSingle<SiteAnalysisRecord>();

  if (!siteAnalysis) {
    throw new Error("No site analysis found for the selected brand.");
  }

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

  const contentTypes = Array.from(new Set((generatedContent ?? []).map((item) => item.content_type)));

  console.log(
    JSON.stringify(
      {
        brandId: brand.id,
        tier: brand.subscription_tier,
        cycleId: summary.cycleId,
        cycleNumber: summary.cycleNumber,
        totalPromptExecutions: summary.totalPromptExecutions,
        testModeApplied: summary.testModeApplied,
        generatedContentCount: generatedContent?.length ?? 0,
        contentTypes,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(
    JSON.stringify(
      {
        message: error instanceof Error ? error.message : "Unknown script error",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
});
