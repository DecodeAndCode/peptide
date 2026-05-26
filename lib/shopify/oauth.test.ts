import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import { verifyShopifyHmac } from "@/lib/shopify/oauth";

const SECRET = "hush";

function sign(message: string, secret = SECRET): string {
  return createHmac("sha256", secret).update(message).digest("hex");
}

describe("verifyShopifyHmac", () => {
  it("returns true when the HMAC matches sorted params (excluding hmac)", () => {
    const message = "code=abc&shop=suppgo-test.myshopify.com&state=xyz&timestamp=1700000000";
    const hmac = sign(message);
    const params = new URLSearchParams({
      shop: "suppgo-test.myshopify.com",
      code: "abc",
      state: "xyz",
      timestamp: "1700000000",
      hmac,
    });

    expect(verifyShopifyHmac(params, SECRET)).toBe(true);
  });

  it("returns true regardless of input param order (we sort alphabetically)", () => {
    const message = "code=abc&shop=suppgo-test.myshopify.com&state=xyz&timestamp=1700000000";
    const hmac = sign(message);
    const params = new URLSearchParams();
    params.set("timestamp", "1700000000");
    params.set("state", "xyz");
    params.set("shop", "suppgo-test.myshopify.com");
    params.set("code", "abc");
    params.set("hmac", hmac);

    expect(verifyShopifyHmac(params, SECRET)).toBe(true);
  });

  it("excludes `signature` from the signed message", () => {
    const message = "code=abc&shop=suppgo-test.myshopify.com&state=xyz&timestamp=1700000000";
    const hmac = sign(message);
    const params = new URLSearchParams({
      shop: "suppgo-test.myshopify.com",
      code: "abc",
      state: "xyz",
      timestamp: "1700000000",
      signature: "legacy-noise",
      hmac,
    });

    expect(verifyShopifyHmac(params, SECRET)).toBe(true);
  });

  it("returns false when hmac is missing", () => {
    const params = new URLSearchParams({ shop: "suppgo-test.myshopify.com", code: "abc" });
    expect(verifyShopifyHmac(params, SECRET)).toBe(false);
  });

  it("returns false when secret does not match", () => {
    const message = "code=abc&shop=suppgo-test.myshopify.com";
    const params = new URLSearchParams({
      shop: "suppgo-test.myshopify.com",
      code: "abc",
      hmac: sign(message, "wrong-secret"),
    });
    expect(verifyShopifyHmac(params, SECRET)).toBe(false);
  });

  it("returns false when a param value is tampered with", () => {
    const message = "code=abc&shop=suppgo-test.myshopify.com";
    const hmac = sign(message);
    const params = new URLSearchParams({
      shop: "evil-shop.myshopify.com",
      code: "abc",
      hmac,
    });
    expect(verifyShopifyHmac(params, SECRET)).toBe(false);
  });

  it("returns false when the hmac is the wrong length", () => {
    const params = new URLSearchParams({
      shop: "suppgo-test.myshopify.com",
      hmac: "deadbeef",
    });
    expect(verifyShopifyHmac(params, SECRET)).toBe(false);
  });
});
