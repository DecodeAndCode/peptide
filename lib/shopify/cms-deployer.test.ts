import { describe, expect, it } from "vitest";
import {
  MIN_PRODUCT_MATCH_SCORE,
  buildProductMetafields,
  findProductMatch,
  routeContent,
} from "@/lib/shopify/cms-deployer";
import { SHOPIFY_METAFIELD_KEYS, SHOPIFY_METAFIELD_NAMESPACE } from "@/lib/shopify/client";
import type { ShopifyProductSummary } from "@/lib/shopify/client";
import type { GeneratedContentRecord } from "@/types";

function makeContent(overrides: Partial<GeneratedContentRecord> = {}): GeneratedContentRecord {
  return {
    id: "content-1",
    brand_id: "brand-1",
    cycle_id: "cycle-1",
    content_type: "faq_snippet",
    title: "Magnesium Glycinate 400mg",
    body: "Magnesium glycinate is a chelated form of magnesium.\n\nSecond paragraph here.",
    target_prompts: [],
    medical_sources: [],
    created_at: "",
    ...overrides,
  };
}

function makeProduct(overrides: Partial<ShopifyProductSummary> = {}): ShopifyProductSummary {
  return {
    id: "gid://shopify/Product/1",
    title: "Magnesium Glycinate 400mg",
    handle: "magnesium-glycinate-400mg",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("routeContent", () => {
  it("routes faq_snippet to article", () => {
    expect(routeContent(makeContent({ content_type: "faq_snippet" }))).toEqual({ kind: "article" });
  });

  it("routes product_interaction to article", () => {
    expect(routeContent(makeContent({ content_type: "product_interaction" }))).toEqual({
      kind: "article",
    });
  });

  it("routes blog_post to article", () => {
    expect(
      routeContent(makeContent({ content_type: "blog_post" as GeneratedContentRecord["content_type"] })),
    ).toEqual({ kind: "article" });
  });

  it("routes product_description to product metafield", () => {
    expect(
      routeContent(
        makeContent({ content_type: "product_description" as GeneratedContentRecord["content_type"] }),
      ),
    ).toEqual({ kind: "product_metafield" });
  });

  it("routes landing_page_section to page", () => {
    expect(
      routeContent(
        makeContent({ content_type: "landing_page_section" as GeneratedContentRecord["content_type"] }),
      ),
    ).toEqual({ kind: "page" });
  });

  it("skips llms_txt with a reason", () => {
    const result = routeContent(makeContent({ content_type: "llms_txt", title: null }));
    expect(result.kind).toBe("skip");
    if (result.kind === "skip") {
      expect(result.reason).toMatch(/llms_txt/);
    }
  });

  it("skips unknown content types", () => {
    const result = routeContent(
      makeContent({ content_type: "totally_made_up" as GeneratedContentRecord["content_type"] }),
    );
    expect(result.kind).toBe("skip");
  });
});

describe("findProductMatch", () => {
  it("returns null when title is empty", () => {
    const result = findProductMatch(makeContent({ title: "" }), [makeProduct()]);
    expect(result).toBeNull();
  });

  it("scores handle equality high", () => {
    const result = findProductMatch(
      makeContent({ title: "Magnesium Glycinate 400mg" }),
      [makeProduct()],
    );
    expect(result?.score).toBeGreaterThanOrEqual(MIN_PRODUCT_MATCH_SCORE);
    expect(result?.product.handle).toBe("magnesium-glycinate-400mg");
  });

  it("scores normalized title equality high", () => {
    const result = findProductMatch(
      makeContent({ title: "Magnesium Glycinate 400mg" }),
      [makeProduct({ handle: "completely-different-handle" })],
    );
    expect(result?.score).toBeGreaterThanOrEqual(MIN_PRODUCT_MATCH_SCORE);
  });

  it("falls below the match threshold for substring-only matches", () => {
    const result = findProductMatch(
      makeContent({ title: "Magnesium" }),
      [makeProduct({ handle: "nothing-related", title: "Magnesium Glycinate 400mg" })],
    );
    expect(result?.score).toBeLessThan(MIN_PRODUCT_MATCH_SCORE);
  });

  it("returns null when no product scores above zero", () => {
    const result = findProductMatch(
      makeContent({ title: "Zinc Picolinate 50mg" }),
      [makeProduct({ handle: "vitamin-d3", title: "Vitamin D3" })],
    );
    expect(result).toBeNull();
  });

  it("picks the highest-scoring product when several match", () => {
    const products = [
      makeProduct({ id: "gid://shopify/Product/10", title: "Magnesium", handle: "magnesium" }),
      makeProduct(),
    ];
    const result = findProductMatch(makeContent(), products);
    expect(result?.product.id).toBe("gid://shopify/Product/1");
  });
});

describe("buildProductMetafields", () => {
  it("returns three metafields in the suppgo namespace", () => {
    const metafields = buildProductMetafields(makeContent(), makeProduct());
    expect(metafields).toHaveLength(3);
    for (const mf of metafields) {
      expect(mf.namespace).toBe(SHOPIFY_METAFIELD_NAMESPACE);
      expect(mf.ownerId).toBe("gid://shopify/Product/1");
    }
  });

  it("sets the body metafield to multi-line html", () => {
    const [body] = buildProductMetafields(makeContent(), makeProduct());
    expect(body.key).toBe(SHOPIFY_METAFIELD_KEYS.body);
    expect(body.type).toBe("multi_line_text_field");
    expect(body.value).toContain("<p>");
  });

  it("falls back to product title when content.title is null", () => {
    const metafields = buildProductMetafields(makeContent({ title: null }), makeProduct());
    const seoTitle = metafields.find((mf) => mf.key === SHOPIFY_METAFIELD_KEYS.seoTitle);
    expect(seoTitle?.value).toBe("Magnesium Glycinate 400mg");
  });

  it("uses excerpt for the seo description metafield", () => {
    const metafields = buildProductMetafields(makeContent(), makeProduct());
    const seoDesc = metafields.find((mf) => mf.key === SHOPIFY_METAFIELD_KEYS.seoDescription);
    expect(seoDesc?.type).toBe("multi_line_text_field");
    expect(seoDesc?.value).toBeTruthy();
  });
});
