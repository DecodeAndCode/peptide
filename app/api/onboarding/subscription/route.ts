import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";

const subscriptionSchema = z.object({
  subscriptionTier: z.enum(["starter", "growth", "pro"]),
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
  const parsed = subscriptionSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid subscription selection." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Complete brand setup before selecting a plan." }, { status: 400 });
  }

  const trialEndsAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString();

  const { error } = await supabase
    .from("brands")
    .update({
      subscription_tier: parsed.data.subscriptionTier,
      subscription_status: "trial",
      trial_ends_at: trialEndsAt,
      onboarding_complete: true,
    })
    .eq("id", brand.id);

  if (error) {
    return NextResponse.json({ error: "Unable to start the free trial." }, { status: 500 });
  }

  return NextResponse.json({ redirectTo: "/dashboard" });
}
