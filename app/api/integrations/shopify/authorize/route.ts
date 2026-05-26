import { NextResponse } from "next/server";
import { cookies } from "next/headers";
import { randomBytes } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { isValidShopDomain, normalizeShopDomain } from "@/lib/shopify/client";

const DEFAULT_SCOPES = "read_products,write_products,read_content,write_content,read_themes";

export async function GET(request: Request) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const dest = from === "onboarding" ? "/onboarding" : "/settings";
  const clientId = process.env.SHOPIFY_API_KEY;
  const scopes = process.env.SHOPIFY_SCOPES?.trim() || DEFAULT_SCOPES;

  if (!clientId) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_not_configured`);
  }

  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const rawShop = searchParams.get("shop");
  if (!rawShop) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_missing_shop`);
  }
  const shop = normalizeShopDomain(rawShop);
  if (!isValidShopDomain(shop)) {
    return NextResponse.redirect(`${appUrl}${dest}?error=shopify_invalid_shop`);
  }

  const state = randomBytes(24).toString("hex");
  const cookieStore = cookies();
  cookieStore.set("shopify_oauth_state", state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  cookieStore.set("shopify_oauth_shop", shop, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });

  if (from) {
    cookieStore.set("shopify_oauth_from", from, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 600,
    });
  }

  const params = new URLSearchParams({
    client_id: clientId,
    scope: scopes,
    redirect_uri: `${appUrl}/api/integrations/shopify/callback`,
    state,
    "grant_options[]": "",
  });

  return NextResponse.redirect(`https://${shop}/admin/oauth/authorize?${params.toString()}`);
}
