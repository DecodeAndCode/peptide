import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const onboardingProfileSchema = z.object({
  brandName: z.string().trim().min(2).max(120),
  websiteUrl: z.url(),
  industryTags: z.array(z.string().trim().min(1)).min(1).max(12),
  competitorUrls: z.array(z.url()).max(5),
});

export async function POST(request: Request) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = onboardingProfileSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid onboarding profile." }, { status: 400 });
  }

  const payload = {
    user_id: user.id,
    brand_name: parsed.data.brandName,
    website_url: parsed.data.websiteUrl,
    industry_tags: parsed.data.industryTags,
    competitor_urls: parsed.data.competitorUrls,
  };

  const { data: existingBrand } = await supabase
    .from("brands")
    .select("id, subscription_tier")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  const operation = existingBrand
    ? supabase
        .from("brands")
        .update(payload)
        .eq("id", existingBrand.id)
        .select("id, subscription_tier")
        .single()
    : supabase
        .from("brands")
        .insert(payload)
        .select("id, subscription_tier")
        .single();

  const { data, error } = await operation;

  if (error || !data) {
    return NextResponse.json({ error: "Unable to save onboarding details." }, { status: 500 });
  }

  return NextResponse.json({
    brandId: data.id,
    subscriptionTier: data.subscription_tier,
  });
}
