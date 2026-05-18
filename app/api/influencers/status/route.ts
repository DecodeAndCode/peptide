import { NextResponse } from "next/server";
import { z } from "zod";
import { enforceSameOrigin } from "@/lib/security";
import { createClient } from "@/lib/supabase/server";
import type { BrandRecord, InfluencerOutreachStatus } from "@/types";

const updateSchema = z.object({
  influencerId: z.string().uuid(),
  outreachStatus: z.enum(["not_contacted", "contacted", "responded", "partnered", "archived"]),
  outreachNotes: z.string().max(2000).optional().default(""),
});

export async function PATCH(request: Request) {
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
  const parsed = updateSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid request payload." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle<BrandRecord>();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  const { influencerId, outreachStatus, outreachNotes } = parsed.data;

  const { data: existing } = await supabase
    .from("influencer_matches")
    .select("id, brand_id")
    .eq("id", influencerId)
    .eq("brand_id", brand.id)
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: "Influencer match not found." }, { status: 404 });
  }

  const statusChangedToContactStep = (value: InfluencerOutreachStatus) =>
    value === "contacted" || value === "responded" || value === "partnered";

  const { error } = await supabase
    .from("influencer_matches")
    .update({
      outreach_status: outreachStatus,
      outreach_notes: outreachNotes.trim() || null,
      last_outreach_at: statusChangedToContactStep(outreachStatus) ? new Date().toISOString() : null,
    })
    .eq("id", influencerId)
    .eq("brand_id", brand.id);

  if (error) {
    return NextResponse.json({ error: "Unable to update outreach status." }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

