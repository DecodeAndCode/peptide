import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { saveShopifyIntegration } from "@/lib/integrations";
import { enforceSameOrigin } from "@/lib/security";
import {
  getShopifyShop,
  isValidShopDomain,
  normalizeShopDomain,
} from "@/lib/shopify/client";

const ACCESS_TOKEN_PATTERN = /^shpat_[A-Za-z0-9]{20,}$/;

export async function POST(request: Request) {
  const sameOriginError = enforceSameOrigin(request);
  if (sameOriginError) return sameOriginError;

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  let body: { shopDomain?: unknown; accessToken?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const rawShop = typeof body.shopDomain === "string" ? body.shopDomain : "";
  const rawToken = typeof body.accessToken === "string" ? body.accessToken.trim() : "";

  if (!rawShop || !isValidShopDomain(rawShop)) {
    return NextResponse.json(
      { error: "Enter a valid *.myshopify.com domain." },
      { status: 400 },
    );
  }
  if (!ACCESS_TOKEN_PATTERN.test(rawToken)) {
    return NextResponse.json(
      { error: "Admin API access token must start with shpat_ and be at least 20 chars." },
      { status: 400 },
    );
  }

  const shopDomain = normalizeShopDomain(rawShop);

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

  let shopName: string;
  try {
    const shop = await getShopifyShop(rawToken, shopDomain);
    shopName = shop.name;
  } catch (err) {
    const message = err instanceof Error ? err.message : "Shopify rejected the token.";
    return NextResponse.json(
      { error: `Could not reach Shopify with that token: ${message}` },
      { status: 400 },
    );
  }

  try {
    await saveShopifyIntegration({
      brandId: brand.id,
      accessToken: rawToken,
      shopDomain,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to save Shopify integration.";
    return NextResponse.json({ error: message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, shopDomain, shopName });
}
