import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import {
  getDecryptedAccessToken,
  getWebflowIntegration,
  updateWebflowSiteConfig,
} from "@/lib/integrations";
import { listWebflowSites } from "@/lib/webflow/client";
import { enforceSameOrigin } from "@/lib/security";

export async function GET() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });

  const integration = await getWebflowIntegration(brand.id);
  if (!integration) return NextResponse.json({ error: "Webflow not connected." }, { status: 400 });

  try {
    const sites = await listWebflowSites(getDecryptedAccessToken(integration));
    return NextResponse.json({ sites });
  } catch {
    return NextResponse.json({ error: "Failed to fetch Webflow sites." }, { status: 502 });
  }
}

export async function PATCH(request: Request) {
  const sameOriginError = enforceSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return NextResponse.json({ error: "Unauthorized." }, { status: 401 });

  const body = (await request.json().catch(() => null)) as {
    site_id?: string;
    site_name?: string;
    preview_url?: string | null;
  } | null;
  if (!body?.site_id || !body.site_name) {
    return NextResponse.json({ error: "Site selection is required." }, { status: 400 });
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) return NextResponse.json({ error: "Brand not found." }, { status: 404 });

  try {
    await updateWebflowSiteConfig({
      brandId: brand.id,
      siteId: body.site_id,
      siteName: body.site_name,
      previewUrl: body.preview_url ?? null,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save Webflow site.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
