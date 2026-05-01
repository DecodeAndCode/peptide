import "server-only";
import { createClient } from "@/lib/supabase/server";
import { encryptSecret, decryptSecret } from "@/lib/crypto";
import type {
  IntegrationRecord,
  GitHubIntegrationStatus,
  GitHubCredentials,
  ContentDeploymentRecord,
  ContentDeploymentStatus,
} from "@/types";

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
    repo_full_name: record.credentials.repo_full_name,
    content_dir: record.credentials.content_dir,
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
// Content deployment helpers
// ---------------------------------------------------------------------------

export async function recordContentDeployment(opts: {
  contentId: string;
  brandId: string;
  integrationType: "github";
  externalUrl: string;
  status: ContentDeploymentStatus;
}): Promise<ContentDeploymentRecord> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("content_deployments")
    .insert({
      content_id: opts.contentId,
      brand_id: opts.brandId,
      integration_type: opts.integrationType,
      external_url: opts.externalUrl,
      status: opts.status,
      deployed_at: opts.status === "deployed" ? new Date().toISOString() : null,
    })
    .select()
    .single();

  if (error) {
    throw new Error(`Failed to record content deployment: ${error.message}`);
  }

  return data as ContentDeploymentRecord;
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
