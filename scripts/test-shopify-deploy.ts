import fs from "node:fs";
import path from "node:path";
import Module from "node:module";
import type { BrandRecord, GeneratedContentRecord } from "@/types";

const moduleProto = Module.prototype as unknown as {
  require: (id: string) => unknown;
  __shopify_patched?: boolean;
};

function makeDryRunSupabaseStub() {
  const chainable: Record<string, unknown> = {};
  const chainResult = { data: null, error: null };
  const chainPromise = Promise.resolve(chainResult);
  for (const method of [
    "from",
    "select",
    "insert",
    "update",
    "delete",
    "eq",
    "neq",
    "order",
    "limit",
    "single",
    "maybeSingle",
    "in",
    "or",
    "filter",
    "match",
    "upsert",
  ]) {
    chainable[method] = () => chainable;
  }
  chainable.then = (
    onResolve?: (value: typeof chainResult) => unknown,
    onReject?: (reason: unknown) => unknown,
  ) => chainPromise.then(onResolve, onReject);
  const client = {
    from: () => chainable,
    auth: { getUser: async () => ({ data: { user: null }, error: null }) },
  };
  return client;
}

const isDryRunMode = () => process.env.SUPPGO_CMS_DRY_RUN === "1";

function makeDryRunIntegrationsStub() {
  const now = () => new Date().toISOString();
  const runId = "dryrun-run-" + Math.random().toString(36).slice(2, 10);
  let lastRun = {
    id: runId,
    cycle_id: "dryrun-cycle",
    brand_id: "dryrun-brand",
    integration_type: "shopify",
    status: "running",
    created_count: 0,
    updated_count: 0,
    skipped_count: 0,
    preview_links: [] as unknown[],
    warnings: [] as string[],
    error_message: null as string | null,
    started_at: now(),
    completed_at: null as string | null,
    created_at: now(),
  };
  return {
    getShopifyIntegration: async () => null,
    getDecryptedAccessToken: () => "",
    createCmsDeploymentRun: async () => lastRun,
    updateCmsDeploymentRun: async (_id: string, patch: Record<string, unknown>) => {
      lastRun = {
        ...lastRun,
        status: (patch.status as string) ?? lastRun.status,
        created_count: (patch.createdCount as number) ?? lastRun.created_count,
        updated_count: (patch.updatedCount as number) ?? lastRun.updated_count,
        skipped_count: (patch.skippedCount as number) ?? lastRun.skipped_count,
        preview_links: (patch.previewLinks as unknown[]) ?? lastRun.preview_links,
        warnings: (patch.warnings as string[]) ?? lastRun.warnings,
        error_message: (patch.errorMessage as string | null) ?? lastRun.error_message,
        completed_at: now(),
      };
      return lastRun;
    },
    recordContentDeployment: async () => undefined,
    updateShopifyShopConfig: async () => undefined,
  };
}

if (!moduleProto.__shopify_patched) {
  const originalRequire = moduleProto.require;
  moduleProto.require = function patchedRequire(this: NodeJS.Module, id: string) {
    if (id === "server-only") return {};
    if (isDryRunMode()) {
      if (id === "@/lib/supabase/server" || id.endsWith("/lib/supabase/server")) {
        const stub = makeDryRunSupabaseStub();
        return { createClient: () => stub, createServiceRoleClient: () => stub };
      }
      if (id === "@/lib/integrations" || id.endsWith("/lib/integrations")) {
        return makeDryRunIntegrationsStub();
      }
    }
    return originalRequire.call(this, id);
  };
  moduleProto.__shopify_patched = true;
}

function loadEnvFile(filePath: string) {
  if (!fs.existsSync(filePath)) return;
  const contents = fs.readFileSync(filePath, "utf8");

  for (const line of contents.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const separatorIndex = trimmed.indexOf("=");
    if (separatorIndex <= 0) continue;

    const key = trimmed.slice(0, separatorIndex).trim();
    const value = trimmed.slice(separatorIndex + 1).trim();

    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

function parseArgs(argv: string[]) {
  const args: { brandId?: string; cycleId?: string; live?: boolean } = {};
  for (let i = 0; i < argv.length; i += 1) {
    const token = argv[i];
    if (token === "--live") {
      args.live = true;
    } else if (token === "--brand-id" || token === "--brand") {
      args.brandId = argv[++i];
    } else if (token === "--cycle-id" || token === "--cycle") {
      args.cycleId = argv[++i];
    }
  }
  return args;
}

async function main() {
  loadEnvFile(path.join(process.cwd(), ".env.local"));

  const args = parseArgs(process.argv.slice(2));

  if (!args.live && process.env.SUPPGO_CMS_DRY_RUN !== "1") {
    process.env.SUPPGO_CMS_DRY_RUN = "1";
  }

  const dryRun = process.env.SUPPGO_CMS_DRY_RUN === "1";
  console.error(`[test-shopify-deploy] mode=${dryRun ? "dry-run" : "live"}`);

  if (dryRun) {
    const [{ deployCycleToShopify }] = await Promise.all([
      import("@/lib/shopify/cms-deployer"),
    ]);

    const brand: BrandRecord = {
      id: "dryrun-brand",
      user_id: "dryrun-user",
      brand_name: "Dry Run Brand",
      brand_aliases: [],
      website_url: "https://dryrun.example",
      industry_tags: ["supplements"],
      competitor_urls: [],
      subscription_tier: "starter",
      subscription_status: "active",
      trial_ends_at: null,
      onboarding_complete: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    const content: GeneratedContentRecord[] = [
      {
        id: "dryrun-content-1",
        brand_id: brand.id,
        cycle_id: "dryrun-cycle",
        content_type: "faq_snippet",
        title: "How do I stack peptides safely?",
        body: "Always consult a physician.\n\nStack BPC-157 with TB-500 for synergistic healing.",
        target_prompts: [],
        medical_sources: [],
        created_at: new Date().toISOString(),
      },
      {
        id: "dryrun-content-2",
        brand_id: brand.id,
        cycle_id: "dryrun-cycle",
        content_type: "product_description" as GeneratedContentRecord["content_type"],
        title: "Magnesium Glycinate 400mg",
        body: "Chelated magnesium glycinate supports relaxation and sleep.\n\nTake 1-2 capsules at night.",
        target_prompts: [],
        medical_sources: [],
        created_at: new Date().toISOString(),
      },
    ];

    const run = await deployCycleToShopify({
      brand,
      cycleId: "dryrun-cycle",
      content,
      dryRun: true,
    });

    console.log(JSON.stringify(run, null, 2));
    process.exit(run.status === "failed" ? 1 : 0);
  }

  if (!args.brandId || !args.cycleId) {
    throw new Error("--live requires --brand-id <id> --cycle-id <id>");
  }

  const [{ deployCycleToShopify }, { createServiceRoleClient }] = await Promise.all([
    import("@/lib/shopify/cms-deployer"),
    import("@/lib/supabase/service"),
  ]);

  const supabase = createServiceRoleClient();

  const { data: brand } = await supabase
    .from("brands")
    .select("*")
    .eq("id", args.brandId)
    .maybeSingle<BrandRecord>();

  if (!brand) throw new Error(`Brand not found: ${args.brandId}`);

  const { data: content } = await supabase
    .from("generated_content")
    .select("*")
    .eq("cycle_id", args.cycleId)
    .eq("brand_id", brand.id)
    .order("created_at", { ascending: true });

  if (!content || content.length === 0) {
    throw new Error(`No generated content found for cycle ${args.cycleId}`);
  }

  const run = await deployCycleToShopify({
    brand,
    cycleId: args.cycleId,
    content: content as GeneratedContentRecord[],
  });

  console.log(JSON.stringify(run, null, 2));
  process.exit(run.status === "failed" ? 1 : 0);
}

main().catch((error) => {
  console.error("[test-shopify-deploy] failed:", error);
  process.exit(1);
});
