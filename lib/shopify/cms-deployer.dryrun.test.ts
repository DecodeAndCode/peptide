import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deployCycleToShopify } from "@/lib/shopify/cms-deployer";
import type { BrandRecord, GeneratedContentRecord } from "@/types";

const runRecord = {
  id: "run-dryrun",
  cycle_id: "cycle-1",
  brand_id: "brand-1",
  integration_type: "shopify" as const,
  status: "running" as const,
  created_count: 0,
  updated_count: 0,
  skipped_count: 0,
  preview_links: [],
  warnings: [],
  error_message: null,
  started_at: new Date().toISOString(),
  completed_at: null,
  created_at: new Date().toISOString(),
};

vi.mock("@/lib/integrations", () => ({
  getShopifyIntegration: vi.fn(),
  getDecryptedAccessToken: vi.fn(),
  createCmsDeploymentRun: vi.fn(async () => ({ ...runRecord })),
  updateCmsDeploymentRun: vi.fn(async (_id: string, patch: Record<string, unknown>) => ({
    ...runRecord,
    status: (patch.status as typeof runRecord.status) ?? runRecord.status,
    created_count: (patch.createdCount as number) ?? runRecord.created_count,
    updated_count: (patch.updatedCount as number) ?? runRecord.updated_count,
    skipped_count: (patch.skippedCount as number) ?? runRecord.skipped_count,
    preview_links: (patch.previewLinks as typeof runRecord.preview_links) ?? runRecord.preview_links,
    warnings: (patch.warnings as string[]) ?? runRecord.warnings,
    error_message: (patch.errorMessage as string | null) ?? runRecord.error_message,
  })),
  recordContentDeployment: vi.fn(async () => undefined),
  updateShopifyShopConfig: vi.fn(async () => undefined),
}));

let fetchSpy: ReturnType<typeof vi.fn>;

beforeEach(() => {
  process.env.SUPPGO_CMS_DRY_RUN = "1";
  fetchSpy = vi.fn();
  vi.stubGlobal("fetch", fetchSpy);
});

afterEach(() => {
  delete process.env.SUPPGO_CMS_DRY_RUN;
  vi.unstubAllGlobals();
  vi.clearAllMocks();
});

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
    body: "Yes, many users combine BPC-157 with TB-500.\n\nSecond paragraph here.",
    target_prompts: [],
    medical_sources: [],
    created_at: "",
    ...overrides,
  };
}

describe("deployCycleToShopify (dry-run)", () => {
  it("creates a draft article against the in-memory fixture without any fetch calls", async () => {
    const run = await deployCycleToShopify({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [makeContent()],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(run.status).toBe("completed");
    expect(run.created_count).toBe(1);
    expect(run.warnings.some((w) => w.startsWith("DRY RUN"))).toBe(true);
    expect(run.preview_links.some((l) => l.type === "shopify_admin")).toBe(true);
    expect(run.preview_links.some((l) => l.type === "shopify_article")).toBe(true);
  });

  it("honors explicit dryRun: true even when the env flag is off", async () => {
    delete process.env.SUPPGO_CMS_DRY_RUN;

    const run = await deployCycleToShopify({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [makeContent()],
      dryRun: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(run.status).toBe("completed");
  });

  it("skips llms_txt content", async () => {
    const run = await deployCycleToShopify({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [makeContent({ id: "llms", content_type: "llms_txt", title: null })],
    });

    expect(run.created_count).toBe(0);
    expect(run.skipped_count).toBe(1);
    expect(run.warnings.some((w) => /llms_txt/.test(w))).toBe(true);
  });

  it("writes product metafields when a product matches by handle", async () => {
    const content = makeContent({
      id: "pd-1",
      content_type: "product_description" as GeneratedContentRecord["content_type"],
      title: "Magnesium Glycinate 400mg",
    });

    const run = await deployCycleToShopify({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [content],
    });

    expect(run.updated_count).toBe(1);
    expect(run.created_count).toBe(0);
    expect(run.preview_links.some((l) => l.type === "shopify_product")).toBe(true);
  });

  it("skips a product description when no product matches", async () => {
    const content = makeContent({
      id: "pd-2",
      content_type: "product_description" as GeneratedContentRecord["content_type"],
      title: "Totally unrelated supplement",
    });

    const run = await deployCycleToShopify({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [content],
    });

    expect(run.updated_count).toBe(0);
    expect(run.skipped_count).toBe(1);
    expect(run.status).toBe("failed");
  });

  it("creates a draft page for landing_page_section content", async () => {
    const content = makeContent({
      id: "lp-1",
      content_type: "landing_page_section" as GeneratedContentRecord["content_type"],
      title: "Hero rewrite for muscle-recovery cluster",
    });

    const run = await deployCycleToShopify({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [content],
    });

    expect(run.created_count).toBe(1);
    expect(run.preview_links.some((l) => l.type === "shopify_page")).toBe(true);
  });
});
