import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { deployCycleToWebflow } from "@/lib/webflow/cms-deployer";
import type { BrandRecord, GeneratedContentRecord } from "@/types";

const runRecord = {
  id: "run-dryrun",
  cycle_id: "cycle-1",
  brand_id: "brand-1",
  integration_type: "webflow" as const,
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
  getWebflowIntegration: vi.fn(),
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
  updateWebflowSiteConfig: vi.fn(async () => undefined),
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
    body: "Yes, many users combine BPC-157 with TB-500.\n\nSecond paragraph.",
    target_prompts: [],
    medical_sources: [],
    created_at: "",
    ...overrides,
  };
}

describe("deployCycleToWebflow (dry-run)", () => {
  it("creates drafts against the in-memory fixture without any fetch calls", async () => {
    const run = await deployCycleToWebflow({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [makeContent()],
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(run.status).toBe("completed");
    expect(run.created_count).toBeGreaterThan(0);
    expect(run.warnings.some((w) => w.startsWith("DRY RUN"))).toBe(true);
  });

  it("honors explicit dryRun: true even when env flag is off", async () => {
    delete process.env.SUPPGO_CMS_DRY_RUN;

    const run = await deployCycleToWebflow({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [makeContent()],
      dryRun: true,
    });

    expect(fetchSpy).not.toHaveBeenCalled();
    expect(run.status).toBe("completed");
  });

  it("filters out llms_txt content", async () => {
    const run = await deployCycleToWebflow({
      brand: makeBrand(),
      cycleId: "cycle-1",
      content: [makeContent({ id: "llms", content_type: "llms_txt", title: null })],
    });

    expect(run.created_count).toBe(0);
    expect(run.warnings.some((w) => w.includes("No CMS-ready"))).toBe(true);
  });
});
