import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { disconnectWebflowIntegration } from "@/lib/integrations";
import { enforceSameOrigin } from "@/lib/security";

export async function DELETE(request: Request) {
  const sameOriginError = enforceSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.json({ error: "Brand not found." }, { status: 404 });
  }

  try {
    await disconnectWebflowIntegration(brand.id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to disconnect Webflow.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
