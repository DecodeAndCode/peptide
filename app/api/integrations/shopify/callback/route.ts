import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { createClient } from "@/lib/supabase/server";
import { saveShopifyIntegration } from "@/lib/integrations";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/client";
import { verifyShopifyHmac } from "@/lib/shopify/oauth";

interface ShopifyTokenResponse {
  access_token?: string;
  scope?: string;
  error?: string;
  error_description?: string;
}

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get("code");
  const state = requestUrl.searchParams.get("state");
  const shopParam = requestUrl.searchParams.get("shop");
  const hmacParam = requestUrl.searchParams.get("hmac");

  const cookieStore = cookies();
  const savedState = cookieStore.get("shopify_oauth_state")?.value;
  const savedShop = cookieStore.get("shopify_oauth_shop")?.value ?? null;
  const from = cookieStore.get("shopify_oauth_from")?.value ?? "settings";
  cookieStore.set("shopify_oauth_state", "", { maxAge: 0, path: "/" });
  cookieStore.set("shopify_oauth_shop", "", { maxAge: 0, path: "/" });
  cookieStore.set("shopify_oauth_from", "", { maxAge: 0, path: "/" });

  const dest = from === "onboarding" ? "/onboarding" : "/settings";

  if (!code || !state || !savedState || state !== savedState) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_auth_failed`);
  }

  const shop = shopParam ? normalizeShopDomain(shopParam) : null;
  if (!shop || !isValidShopDomain(shop)) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_invalid_shop`);
  }

  if (savedShop && savedShop !== shop) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_shop_mismatch`);
  }

  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_not_configured`);
  }

  if (!hmacParam || !verifyShopifyHmac(requestUrl.searchParams, clientSecret)) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_hmac_invalid`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${appUrl}/login`);
  }

  let tokenData: ShopifyTokenResponse;
  try {
    const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
      }),
    });
    tokenData = (await res.json()) as ShopifyTokenResponse;
  } catch {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_token_exchange_failed`);
  }

  if (!tokenData.access_token) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_token_missing`);
  }

  const { data: brand } = await supabase
    .from("brands")
    .select("id")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!brand) {
    return NextResponse.redirect(`${appUrl}/onboarding`);
  }

  try {
    await saveShopifyIntegration({
      brandId: brand.id,
      accessToken: tokenData.access_token,
      shopDomain: shop,
      scope: tokenData.scope ?? null,
    });
  } catch {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_save_failed`);
  }

  return NextResponse.redirect(`${appUrl}${dest}?shopify=connected`);
}
