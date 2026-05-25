import "server-only";
import { paragraphsToHtml } from "@/lib/text";
import type { GeneratedContentRecord, WebflowSiteSummary } from "@/types";

const WEBFLOW_API_BASE = "https://api.webflow.com/v2";

export interface WebflowField {
  id: string;
  slug: string;
  displayName: string;
  type: string;
  isRequired: boolean;
  isEditable: boolean;
}

export interface WebflowCollection {
  id: string;
  displayName: string;
  singularName: string;
  fields?: WebflowField[];
}

export interface WebflowItem {
  id: string;
  fieldData: Record<string, unknown>;
  isDraft?: boolean;
  isArchived?: boolean;
  lastPublished?: string | null;
}

interface WebflowListSitesResponse {
  sites?: Array<{
    id: string;
    displayName?: string;
    shortName?: string;
    previewUrl?: string;
  }>;
}

interface WebflowListCollectionsResponse {
  collections?: WebflowCollection[];
}

interface WebflowListItemsResponse {
  items?: WebflowItem[];
  pagination?: {
    total: number;
    limit: number;
    offset: number;
  };
}

interface WebflowCreateItemResponse {
  id: string;
  fieldData?: Record<string, unknown>;
}

async function webflowRequest<T>(accessToken: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${WEBFLOW_API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Webflow API request failed (${res.status}): ${text || res.statusText}`);
  }

  return (await res.json()) as T;
}

export async function listWebflowSites(accessToken: string): Promise<WebflowSiteSummary[]> {
  const data = await webflowRequest<WebflowListSitesResponse>(accessToken, "/sites");
  return (data.sites ?? []).map((site) => ({
    id: site.id,
    displayName: site.displayName ?? site.shortName ?? "Untitled Webflow site",
    shortName: site.shortName ?? null,
    previewUrl: site.previewUrl ?? null,
  }));
}

export async function listWebflowCollections(accessToken: string, siteId: string): Promise<WebflowCollection[]> {
  const data = await webflowRequest<WebflowListCollectionsResponse>(accessToken, `/sites/${siteId}/collections`);
  return data.collections ?? [];
}

export async function getWebflowCollection(accessToken: string, collectionId: string): Promise<WebflowCollection> {
  return webflowRequest<WebflowCollection>(accessToken, `/collections/${collectionId}`);
}

export async function listWebflowItems(accessToken: string, collectionId: string, limit = 100): Promise<WebflowItem[]> {
  const items: WebflowItem[] = [];
  let offset = 0;

  while (items.length < limit) {
    const data = await webflowRequest<WebflowListItemsResponse>(
      accessToken,
      `/collections/${collectionId}/items?limit=100&offset=${offset}`,
    );
    items.push(...(data.items ?? []));
    const pagination = data.pagination;
    if (!pagination || items.length >= pagination.total || (data.items ?? []).length === 0) break;
    offset += pagination.limit;
  }

  return items.slice(0, limit);
}

export async function createWebflowDraftItem(opts: {
  accessToken: string;
  collectionId: string;
  fieldData: Record<string, unknown>;
}): Promise<WebflowCreateItemResponse> {
  return webflowRequest<WebflowCreateItemResponse>(opts.accessToken, `/collections/${opts.collectionId}/items/bulk`, {
    method: "POST",
    body: JSON.stringify({
      fieldData: opts.fieldData,
      isArchived: false,
      isDraft: true,
    }),
  });
}

export async function updateWebflowDraftItem(opts: {
  accessToken: string;
  collectionId: string;
  itemId: string;
  fieldData: Record<string, unknown>;
}): Promise<WebflowCreateItemResponse> {
  return webflowRequest<WebflowCreateItemResponse>(
    opts.accessToken,
    `/collections/${opts.collectionId}/items/${opts.itemId}`,
    {
      method: "PATCH",
      body: JSON.stringify({
        fieldData: opts.fieldData,
        isDraft: true,
      }),
    },
  );
}

export function buildWebflowDashboardUrl(shortName: string | null) {
  if (!shortName) {
    return "https://webflow.com/dashboard";
  }
  return `https://${shortName}.design.webflow.com/?cms`;
}

export function contentToHtml(content: GeneratedContentRecord) {
  return paragraphsToHtml(content.body);
}
