import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

const requestSchema = z.object({
  subscriptionTier: z.enum(["starter", "growth", "pro"]),
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
  const parsed = requestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription tier." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id, subscription_tier")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "No brand found for this account." }, { status: 400 });
  }

  if (brand.subscription_tier === parsed.data.subscriptionTier) {
    return NextResponse.json({ error: "Already on that plan." }, { status: 400 });
  }

  const { error } = await supabase
    .from("brands")
    .update({ subscription_tier: parsed.data.subscriptionTier })
    .eq("id", brand.id);

  if (error) {
    return NextResponse.json({ error: "Unable to update subscription tier." }, { status: 500 });
  }

  return NextResponse.json({ subscriptionTier: parsed.data.subscriptionTier });
}
