import "server-only";
import { randomUUID } from "crypto";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type {
  IntegrationRecord,
  GitHubIntegrationStatus,
  GitHubCredentials,
  WebflowCredentials,
  WebflowIntegrationStatus,
  ContentDeploymentRecord,
  ContentDeploymentStatus,
  CmsDeploymentRunRecord,
  CmsDeploymentRunStatus,
  CmsDeploymentPreviewLink,
  CmsDeploymentActionType,
} from "@/types";

function isMissingSchemaError(error: unknown) {
  const code = (error as { code?: string } | null)?.code;
  const message = (error as { message?: string } | null)?.message ?? "";
  return code === "PGRST205" || code === "PGRST204" || message.includes("schema cache");
}

export interface PublishTargetStatus {
  target: "github" | "cms" | "none";
  connected: boolean;
}

// ---------------------------------------------------------------------------
// GitHub integration helpers
// ---------------------------------------------------------------------------

export async function getGitHubIntegration(brandId: string): Promise<IntegrationRecord | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("integration_type", "github")
    .maybeSingle();
  return (data as IntegrationRecord | null) ?? null;
}

// Returns the safe, token-free status shape for client components.
export async function getGitHubIntegrationStatus(brandId: string): Promise<GitHubIntegrationStatus> {
  const record = await getGitHubIntegration(brandId);
  if (!record) {
    return { connected: false, repo_full_name: null, content_dir: null, status: "disconnected" };
  }
  return {
    connected: record.status === "active",
    repo_full_name: record.credentials.repo_full_name ?? null,
    content_dir: record.credentials.content_dir ?? null,
    status: record.status,
  };
}

// Returns the active publishing target for generated content actions.
export async function getPublishTargetStatus(brandId: string): Promise<PublishTargetStatus> {
  const supabase = createClient();
  const { data } = await supabase
    .from("integrations")
    .select("integration_type, status")
    .eq("brand_id", brandId);

  const rows = (data ?? []) as Array<{ integration_type: string; status: string }>;
  const activeTypes = new Set(
    rows.filter((row) => row.status === "active").map((row) => row.integration_type.toLowerCase()),
  );

  if (activeTypes.has("cms")) {
    return { target: "cms", connected: true };
  }

  if (activeTypes.has("github")) {
    return { target: "github", connected: true };
  }

  return { target: "none", connected: false };
}

// Decrypts the access token from a stored record.
export function getDecryptedAccessToken(record: IntegrationRecord): string {
  return decryptSecret(record.credentials.access_token_enc);
}

export function getDecryptedRefreshToken(record: IntegrationRecord): string | null {
  const encrypted = record.credentials.refresh_token_enc;
  return encrypted ? decryptSecret(encrypted) : null;
}

// Upserts a GitHub integration after OAuth callback.
export async function saveGitHubIntegration(brandId: string, accessToken: string): Promise<void> {
  const supabase = createClient();
  const credentials: GitHubCredentials = {
    access_token_enc: encryptSecret(accessToken),
    repo_full_name: null,
    content_dir: null,
  };

  const { error } = await supabase.from("integrations").upsert(
    {
      brand_id: brandId,
      integration_type: "github",
      credentials,
      status: "active",
    },
    { onConflict: "brand_id,integration_type" },
  );

  if (error) {
    throw new Error(`Failed to save GitHub integration: ${error.message}`);
  }
}

// Updates repo and content directory config without touching the token.
export async function updateGitHubConfig(
  brandId: string,
  repoFullName: string,
  contentDir: string,
): Promise<void> {
  const supabase = createClient();

  const record = await getGitHubIntegration(brandId);
  if (!record) {
    throw new Error("GitHub integration not found.");
  }

  const updatedCredentials: GitHubCredentials = {
    ...record.credentials,
    repo_full_name: repoFullName || null,
    content_dir: contentDir || null,
  };

  const { error } = await supabase
    .from("integrations")
    .update({ credentials: updatedCredentials, last_sync_at: new Date().toISOString() })
    .eq("brand_id", brandId)
    .eq("integration_type", "github");

  if (error) {
    throw new Error(`Failed to update GitHub config: ${error.message}`);
  }
}

// Deletes the GitHub integration row.
export async function disconnectGitHubIntegration(brandId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("brand_id", brandId)
    .eq("integration_type", "github");

  if (error) {
    throw new Error(`Failed to disconnect GitHub integration: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Webflow integration helpers
// ---------------------------------------------------------------------------

export async function getWebflowIntegration(brandId: string): Promise<IntegrationRecord | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("integrations")
    .select("*")
    .eq("brand_id", brandId)
    .eq("integration_type", "webflow")
    .maybeSingle();
  return (data as IntegrationRecord | null) ?? null;
}

export async function getWebflowIntegrationStatus(brandId: string): Promise<WebflowIntegrationStatus> {
  const record = await getWebflowIntegration(brandId);
  if (!record) {
    return { connected: false, site_id: null, site_name: null, preview_url: null, status: "disconnected" };
  }

  return {
    connected: record.status === "active",
    site_id: record.credentials.site_id ?? null,
    site_name: record.credentials.site_name ?? null,
    preview_url: record.credentials.preview_url ?? null,
    status: record.status,
  };
}

export async function saveWebflowIntegration(opts: {
  brandId: string;
  accessToken: string;
  refreshToken?: string | null;
  expiresIn?: number | null;
}): Promise<void> {
  const supabase = createClient();
  const credentials: WebflowCredentials = {
    access_token_enc: encryptSecret(opts.accessToken),
    refresh_token_enc: opts.refreshToken ? encryptSecret(opts.refreshToken) : null,
    token_expires_at: opts.expiresIn ? new Date(Date.now() + opts.expiresIn * 1000).toISOString() : null,
    site_id: null,
    site_name: null,
    preview_url: null,
  };

  const { error } = await supabase.from("integrations").upsert(
    {
      brand_id: opts.brandId,
      integration_type: "webflow",
      credentials,
      status: "active",
    },
    { onConflict: "brand_id,integration_type" },
  );

  if (error) {
    throw new Error(`Failed to save Webflow integration: ${error.message}`);
  }
}

export async function updateWebflowSiteConfig(opts: {
  brandId: string;
  siteId: string;
  siteName: string;
  previewUrl: string | null;
}): Promise<void> {
  const record = await getWebflowIntegration(opts.brandId);
  if (!record) {
    throw new Error("Webflow integration not found.");
  }

  const credentials: WebflowCredentials = {
    access_token_enc: record.credentials.access_token_enc,
    refresh_token_enc: record.credentials.refresh_token_enc ?? null,
    token_expires_at: record.credentials.token_expires_at ?? null,
    site_id: opts.siteId,
    site_name: opts.siteName,
    preview_url: opts.previewUrl,
  };

  const supabase = createClient();
  const { error } = await supabase
    .from("integrations")
    .update({ credentials, last_sync_at: new Date().toISOString() })
    .eq("brand_id", opts.brandId)
    .eq("integration_type", "webflow");

  if (error) {
    throw new Error(`Failed to update Webflow site config: ${error.message}`);
  }
}

export async function disconnectWebflowIntegration(brandId: string): Promise<void> {
  const supabase = createClient();
  const { error } = await supabase
    .from("integrations")
    .delete()
    .eq("brand_id", brandId)
    .eq("integration_type", "webflow");

  if (error) {
    throw new Error(`Failed to disconnect Webflow integration: ${error.message}`);
  }
}

// ---------------------------------------------------------------------------
// Content deployment helpers
// ---------------------------------------------------------------------------

export async function recordContentDeployment(opts: {
  contentId: string;
  brandId: string;
  integrationType: "github" | "webflow";
  externalUrl: string;
  status: ContentDeploymentStatus;
  deploymentRunId?: string | null;
  externalId?: string | null;
  actionType?: CmsDeploymentActionType | null;
  metadata?: Record<string, unknown>;
  errorMessage?: string | null;
}): Promise<ContentDeploymentRecord> {
  const supabase = createClient();
  const basePayload = {
    content_id: opts.contentId,
    brand_id: opts.brandId,
    integration_type: opts.integrationType,
    external_url: opts.externalUrl,
    status: opts.status,
    deployed_at: opts.status === "deployed" ? new Date().toISOString() : null,
  };
  const { data, error } = await supabase
    .from("content_deployments")
    .insert({
      ...basePayload,
      deployment_run_id: opts.deploymentRunId ?? null,
      external_id: opts.externalId ?? null,
      action_type: opts.actionType ?? null,
      metadata: opts.metadata ?? {},
      error_message: opts.errorMessage ?? null,
    })
    .select()
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      const fallback = await supabase.from("content_deployments").insert(basePayload).select().single();
      if (fallback.error) {
        throw new Error(`Failed to record content deployment: ${fallback.error.message}`);
      }
      return fallback.data as ContentDeploymentRecord;
    }
    throw new Error(`Failed to record content deployment: ${error.message}`);
  }

  return data as ContentDeploymentRecord;
}

export async function createCmsDeploymentRun(opts: {
  cycleId: string;
  brandId: string;
  integrationType: "webflow";
}): Promise<CmsDeploymentRunRecord> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("cms_deployment_runs")
    .insert({
      cycle_id: opts.cycleId,
      brand_id: opts.brandId,
      integration_type: opts.integrationType,
      status: "running",
      started_at: new Date().toISOString(),
    })
    .select()
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return {
        id: randomUUID(),
        cycle_id: opts.cycleId,
        brand_id: opts.brandId,
        integration_type: opts.integrationType,
        status: "running",
        created_count: 0,
        updated_count: 0,
        skipped_count: 0,
        preview_links: [],
        warnings: ["CMS deployment run tracking table is not installed yet; using compatibility mode."],
        error_message: null,
        started_at: new Date().toISOString(),
        completed_at: null,
        created_at: new Date().toISOString(),
      };
    }
    throw new Error(`Failed to create CMS deployment run: ${error.message}`);
  }

  return data as CmsDeploymentRunRecord;
}

export async function updateCmsDeploymentRun(
  runId: string,
  patch: {
    status: CmsDeploymentRunStatus;
    createdCount?: number;
    updatedCount?: number;
    skippedCount?: number;
    previewLinks?: CmsDeploymentPreviewLink[];
    warnings?: string[];
    errorMessage?: string | null;
  },
): Promise<CmsDeploymentRunRecord> {
  const supabase = createClient();
  const updates: Record<string, unknown> = {
    status: patch.status,
    error_message: patch.errorMessage ?? null,
  };

  if (patch.createdCount !== undefined) updates.created_count = patch.createdCount;
  if (patch.updatedCount !== undefined) updates.updated_count = patch.updatedCount;
  if (patch.skippedCount !== undefined) updates.skipped_count = patch.skippedCount;
  if (patch.previewLinks !== undefined) updates.preview_links = patch.previewLinks;
  if (patch.warnings !== undefined) updates.warnings = patch.warnings;
  if (["completed", "partial_success", "failed"].includes(patch.status)) {
    updates.completed_at = new Date().toISOString();
  }

  const { data, error } = await supabase
    .from("cms_deployment_runs")
    .update(updates)
    .eq("id", runId)
    .select()
    .single();

  if (error) {
    if (isMissingSchemaError(error)) {
      return {
        id: runId,
        cycle_id: "",
        brand_id: "",
        integration_type: "webflow",
        status: patch.status,
        created_count: patch.createdCount ?? 0,
        updated_count: patch.updatedCount ?? 0,
        skipped_count: patch.skippedCount ?? 0,
        preview_links: patch.previewLinks ?? [],
        warnings: patch.warnings ?? ["CMS deployment run tracking table is not installed yet; using compatibility mode."],
        error_message: patch.errorMessage ?? null,
        started_at: null,
        completed_at: new Date().toISOString(),
        created_at: new Date().toISOString(),
      };
    }
    throw new Error(`Failed to update CMS deployment run: ${error.message}`);
  }

  return data as CmsDeploymentRunRecord;
}

export async function getCmsDeploymentRun(runId: string): Promise<CmsDeploymentRunRecord | null> {
  const supabase = createClient();
  const { data, error } = await supabase.from("cms_deployment_runs").select("*").eq("id", runId).maybeSingle();
  if (error && isMissingSchemaError(error)) {
    return null;
  }
  return (data as CmsDeploymentRunRecord | null) ?? null;
}

// Returns all deployments for a content item (most recent first).
export async function getContentDeployments(contentId: string): Promise<ContentDeploymentRecord[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("content_deployments")
    .select("*")
    .eq("content_id", contentId)
    .order("created_at", { ascending: false });
  return (data as ContentDeploymentRecord[]) ?? [];
}
