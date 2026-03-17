import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { BrandRecord, CycleRecord, SiteAnalysisRecord } from "@/types";

interface DashboardContext {
  userId: string;
  brand: BrandRecord | null;
  latestCycle: CycleRecord | null;
  latestSiteAnalysis: SiteAnalysisRecord | null;
}

export const getDashboardContext = cache(async (): Promise<DashboardContext | null> => {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return null;
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrandRecord>();

  if (!brand) {
    return {
      userId: user.id,
      brand: null,
      latestCycle: null,
      latestSiteAnalysis: null,
    };
  }

  const [{ data: latestCycle }, { data: latestSiteAnalysis }] = await Promise.all([
    supabase
      .from("cycles")
      .select("*")
      .eq("brand_id", brand.id)
      .order("created_at", { ascending: false })
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

  return {
    userId: user.id,
    brand,
    latestCycle: latestCycle ?? null,
    latestSiteAnalysis: latestSiteAnalysis ?? null,
  };
});
