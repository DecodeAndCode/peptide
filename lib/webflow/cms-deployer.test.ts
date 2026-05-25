import { describe, expect, it } from "vitest";
import {
  buildFieldData,
  findExistingItem,
  findField,
  getRequiredTextDefault,
  inferFieldMapping,
  isPlainTextField,
  scoreCollection,
  type FieldMapping,
} from "@/lib/webflow/cms-deployer";
import type { WebflowCollection, WebflowField, WebflowItem } from "@/lib/webflow/client";
import type { BrandRecord, GeneratedContentRecord } from "@/types";

function makeField(
  partial: Partial<WebflowField> & Pick<WebflowField, "slug" | "displayName">,
): WebflowField {
  return {
    id: partial.slug,
    type: "PlainText",
    isRequired: false,
    isEditable: true,
    ...partial,
  };
}

function makeBrand(): BrandRecord {
  return {
    id: "brand-1",
    user_id: "user-1",
    brand_name: "PeptideGo",
    brand_aliases: [],
    website_url: "https://peptidego.example",
    industry_tags: ["supplements"],
    competitor_urls: [],
    subscription_tier: "starter",
    subscription_status: "active",
    trial_ends_at: null,
    onboarding_complete: true,
    created_at: "",
    updated_at: "",
  };
}

function makeContent(overrides: Partial<GeneratedContentRecord> = {}): GeneratedContentRecord {
  return {
    id: "content-1",
    brand_id: "brand-1",
    cycle_id: "cycle-1",
    content_type: "faq_snippet",
    title: "Can I stack BPC-157 with TB-500?",
    body: "Yes, many users combine BPC-157 with TB-500 for synergistic healing.\n\nSecond paragraph here.",
    target_prompts: [],
    medical_sources: [],
    created_at: "",
    ...overrides,
  };
}

describe("findField", () => {
  it("matches by display name or slug, normalized", () => {
    const fields = [
      makeField({ slug: "name", displayName: "Name" }),
      makeField({ slug: "post-body", displayName: "Post Body" }),
    ];
    expect(findField(fields, ["title", "name"])?.slug).toBe("name");
    expect(findField(fields, ["body"])?.slug).toBe("post-body");
  });

  it("returns undefined when nothing matches", () => {
    const fields = [makeField({ slug: "color", displayName: "Color" })];
    expect(findField(fields, ["title", "name"])).toBeUndefined();
  });
});

describe("inferFieldMapping", () => {
  const minimalFields: WebflowField[] = [
    makeField({ slug: "name", displayName: "Name", isRequired: true }),
    makeField({ slug: "slug", displayName: "Slug", isRequired: true }),
    makeField({ slug: "body", displayName: "Body", type: "RichText" }),
  ];

  it("returns mapping when title/slug/body all present", () => {
    const mapping = inferFieldMapping(minimalFields);
    expect(mapping).toEqual({
      title: "name",
      slug: "slug",
      body: "body",
      excerpt: null,
      requiredTextFields: [],
    });
  });

  it("returns null when title missing", () => {
    expect(inferFieldMapping([minimalFields[1], minimalFields[2]])).toBeNull();
  });

  it("returns null when slug missing", () => {
    expect(inferFieldMapping([minimalFields[0], minimalFields[2]])).toBeNull();
  });

  it("returns null when body missing", () => {
    expect(inferFieldMapping([minimalFields[0], minimalFields[1]])).toBeNull();
  });

  it("returns null when a required non-text field has no mapping", () => {
    const fields = [
      ...minimalFields,
      makeField({ slug: "hero", displayName: "Hero image", type: "ImageRef", isRequired: true }),
    ];
    expect(inferFieldMapping(fields)).toBeNull();
  });

  it("collects required plain-text fields not already mapped", () => {
    const fields = [
      ...minimalFields,
      makeField({ slug: "author", displayName: "Author", type: "PlainText", isRequired: true }),
    ];
    expect(inferFieldMapping(fields)?.requiredTextFields).toEqual(["author"]);
  });

  it("drops excerpt mapping when it collides with body slug", () => {
    const fields = [
      makeField({ slug: "name", displayName: "Name", isRequired: true }),
      makeField({ slug: "slug", displayName: "Slug" }),
      makeField({ slug: "description", displayName: "Description", type: "RichText" }),
    ];
    const mapping = inferFieldMapping(fields);
    expect(mapping?.body).toBe("description");
    expect(mapping?.excerpt).toBeNull();
  });
});

describe("scoreCollection", () => {
  const mapping: FieldMapping = {
    title: "name",
    slug: "slug",
    body: "body",
    excerpt: null,
    requiredTextFields: [],
  };

  function makeCollection(name: string, fields: WebflowField[] = []): WebflowCollection {
    return { id: name, displayName: name, singularName: name, fields };
  }

  it("awards baseline + blog-name bonus", () => {
    const score = scoreCollection(makeCollection("Blog Posts"), makeContent(), mapping);
    expect(score).toBeGreaterThanOrEqual(60);
  });

  it("adds FAQ bonus for faq_snippet content in a help/faq collection", () => {
    const score = scoreCollection(
      makeCollection("Help Center"),
      makeContent({ content_type: "faq_snippet" }),
      mapping,
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("adds product bonus for product_interaction in product-named collection", () => {
    const score = scoreCollection(
      makeCollection("Product Guides"),
      makeContent({ content_type: "product_interaction" }),
      mapping,
    );
    expect(score).toBeGreaterThanOrEqual(80);
  });

  it("adds rich-text bonus when any field is rich-text", () => {
    const withRich = scoreCollection(
      makeCollection("Blog", [makeField({ slug: "body", displayName: "Body", type: "RichText" })]),
      makeContent(),
      mapping,
    );
    const without = scoreCollection(makeCollection("Blog"), makeContent(), mapping);
    expect(withRich - without).toBe(10);
  });
});

describe("findExistingItem", () => {
  function makeItem(name: string, slug: string): WebflowItem {
    return { id: `item-${slug}`, fieldData: { name, slug } } as WebflowItem;
  }

  it("matches by exact slug", () => {
    const items = [makeItem("Old Title", "can-i-stack-bpc-157-with-tb-500")];
    const result = findExistingItem(makeContent(), items);
    expect(result?.score).toBeGreaterThanOrEqual(90);
  });

  it("matches by normalized title equality", () => {
    const items = [makeItem("Can I stack BPC-157 with TB-500?", "different-slug")];
    const result = findExistingItem(makeContent(), items);
    expect(result?.score).toBeGreaterThanOrEqual(90);
  });

  it("returns null when items list is empty", () => {
    expect(findExistingItem(makeContent(), [])).toBeNull();
  });

  it("returns null when no item scores above 0", () => {
    const items = [makeItem("Completely unrelated content", "totally-different")];
    expect(findExistingItem(makeContent(), items)).toBeNull();
  });
});

describe("buildFieldData", () => {
  const brand = makeBrand();
  const mapping: FieldMapping = {
    title: "name",
    slug: "slug",
    body: "post-body",
    excerpt: "excerpt",
    requiredTextFields: ["author", "category"],
  };

  it("populates title, slug, body, excerpt", () => {
    const result = buildFieldData(makeContent(), brand, mapping);
    expect(result.name).toBe("Can I stack BPC-157 with TB-500?");
    expect(result.slug).toBe("can-i-stack-bpc-157-with-tb-500");
    expect(result["post-body"]).toContain("<p>");
    expect(result.excerpt).toBeDefined();
  });

  it("fills in required text defaults", () => {
    const result = buildFieldData(makeContent(), brand, mapping);
    expect(result.author).toBe("PeptideGo");
    expect(result.category).toBe("Faq Snippet");
  });

  it("preserves existing fieldData when updating", () => {
    const existing = {
      id: "x",
      fieldData: { name: "Old", slug: "old", color: "red" },
    } as WebflowItem;
    const result = buildFieldData(makeContent(), brand, mapping, existing);
    expect(result.color).toBe("red");
    expect(result.name).toBe("Can I stack BPC-157 with TB-500?");
  });

  it("skips excerpt when mapping.excerpt is null", () => {
    const noExcerpt: FieldMapping = { ...mapping, excerpt: null };
    const result = buildFieldData(makeContent(), brand, noExcerpt);
    expect("excerpt" in result).toBe(false);
  });
});

describe("getRequiredTextDefault", () => {
  const brand = makeBrand();
  const content = makeContent({ content_type: "product_interaction" });

  it("returns brand name for author-ish fields", () => {
    expect(getRequiredTextDefault("author", content, brand)).toBe("PeptideGo");
    expect(getRequiredTextDefault("post-author", content, brand)).toBe("PeptideGo");
  });

  it("returns prettified content type for category/tag fields", () => {
    expect(getRequiredTextDefault("category", content, brand)).toBe("Product Interaction");
    expect(getRequiredTextDefault("primary-tag", content, brand)).toBe("Product Interaction");
  });

  it("returns SuppGo fallback otherwise", () => {
    expect(getRequiredTextDefault("publisher", content, brand)).toBe("SuppGo");
  });
});

describe("isPlainTextField", () => {
  it("returns true only for PlainText and PlainTextField types", () => {
    expect(isPlainTextField(makeField({ slug: "x", displayName: "X", type: "PlainText" }))).toBe(true);
    expect(
      isPlainTextField(makeField({ slug: "x", displayName: "X", type: "PlainTextField" })),
    ).toBe(true);
    expect(isPlainTextField(makeField({ slug: "x", displayName: "X", type: "RichText" }))).toBe(false);
  });
});
