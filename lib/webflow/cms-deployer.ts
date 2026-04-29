import "server-only";
import {
  buildWebflowCmsItemUrl,
  buildWebflowDashboardUrl,
  contentToHtml,
  createWebflowDraftItem,
  getWebflowCollection,
  listWebflowCollections,
  listWebflowItems,
  listWebflowSites,
  updateWebflowDraftItem,
  type WebflowCollection,
  type WebflowField,
  type WebflowItem,
} from "@/lib/webflow/client";
import {
  createCmsDeploymentRun,
  getDecryptedAccessToken,
  getWebflowIntegration,
  recordContentDeployment,
  updateCmsDeploymentRun,
  updateWebflowSiteConfig,
} from "@/lib/integrations";
import type {
  BrandRecord,
  CmsDeploymentPreviewLink,
  CmsDeploymentRunRecord,
  GeneratedContentRecord,
  WebflowSiteSummary,
} from "@/types";

interface DeployCycleOptions {
  brand: BrandRecord;
  cycleId: string;
  content: GeneratedContentRecord[];
}

interface FieldMapping {
  title: string;
  slug: string;
  body: string | null;
  excerpt: string | null;
  requiredTextFields: string[];
}

interface CollectionTarget {
  collection: WebflowCollection;
  mapping: FieldMapping;
  score: number;
}

const MIN_COLLECTION_SCORE = 35;
const MIN_UPDATE_MATCH_SCORE = 85;

export async function deployCycleToWebflow(opts: DeployCycleOptions): Promise<CmsDeploymentRunRecord> {
  const integration = await getWebflowIntegration(opts.brand.id);
  if (!integration || integration.status !== "active") {
    throw new Error("Webflow is not connected. Connect it in Settings first.");
  }

  const accessToken = getDecryptedAccessToken(integration);
  const run = await createCmsDeploymentRun({
    cycleId: opts.cycleId,
    brandId: opts.brand.id,
    integrationType: "webflow",
  });

  const warnings: string[] = [];
  const previewLinks: CmsDeploymentPreviewLink[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    const site = await resolveWebflowSite({
      accessToken,
      brandId: opts.brand.id,
      savedSiteId: integration.credentials.site_id ?? null,
    });

    warnings.push(
      "Webflow changes are saved as drafts. New draft CMS items may not appear on the published site preview until they are reviewed and published in Webflow.",
    );

    if (site.previewUrl) {
      previewLinks.push({
        label: "Open published site preview",
        url: site.previewUrl,
        type: "site_preview",
      });
    } else {
      previewLinks.push({
        label: "Open Webflow dashboard",
        url: buildWebflowDashboardUrl(site.id),
        type: "webflow_dashboard",
      });
    }

    const collections = await listWebflowCollections(accessToken, site.id);
    const contentToDeploy = opts.content.filter((item) => item.content_type !== "llms_txt");

    if (contentToDeploy.length === 0) {
      warnings.push("No CMS-ready generated content was available for this cycle.");
    }

    const collectionCache = new Map<string, WebflowCollection>();
    const itemCache = new Map<string, WebflowItem[]>();

    for (const item of contentToDeploy) {
      const target = await selectCollectionTarget(accessToken, collections, item, collectionCache);

      if (!target) {
        skippedCount += 1;
        const message = `Skipped "${item.title ?? item.content_type}" because no safe Webflow CMS collection match was found.`;
        warnings.push(message);
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: buildWebflowDashboardUrl(site.id),
          status: "failed",
          deploymentRunId: run.id,
          actionType: "skipped",
          errorMessage: message,
        });
        continue;
      }

      const items = await getCachedItems(accessToken, target.collection.id, itemCache);
      const existing = findExistingItem(item, items);
      const fieldData = buildFieldData(item, opts.brand, target.mapping, existing?.item);

      if (existing && existing.score >= MIN_UPDATE_MATCH_SCORE) {
        const result = await updateWebflowDraftItem({
          accessToken,
          collectionId: target.collection.id,
          itemId: existing.item.id,
          fieldData,
        });
        updatedCount += 1;
        const itemUrl = buildWebflowCmsItemUrl(site.id, target.collection.id, existing.item.id);
        previewLinks.push({ label: item.title ?? "Updated CMS draft", url: itemUrl, type: "cms_item" });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: itemUrl,
          status: "deployed",
          deploymentRunId: run.id,
          externalId: result.id ?? existing.item.id,
          actionType: "update_draft",
          metadata: {
            collectionId: target.collection.id,
            collectionName: target.collection.displayName,
            matchScore: existing.score,
            fieldMapping: target.mapping,
          },
        });
      } else if (existing) {
        skippedCount += 1;
        const message = `Skipped "${item.title ?? item.content_type}" because the closest existing CMS item match was low confidence.`;
        warnings.push(message);
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: buildWebflowDashboardUrl(site.id),
          status: "failed",
          deploymentRunId: run.id,
          actionType: "skipped",
          errorMessage: message,
          metadata: { matchScore: existing.score, collectionId: target.collection.id },
        });
      } else {
        const result = await createWebflowDraftItem({
          accessToken,
          collectionId: target.collection.id,
          fieldData,
        });
        createdCount += 1;
        const itemUrl = buildWebflowCmsItemUrl(site.id, target.collection.id, result.id);
        previewLinks.push({ label: item.title ?? "New CMS draft", url: itemUrl, type: "cms_item" });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: itemUrl,
          status: "deployed",
          deploymentRunId: run.id,
          externalId: result.id,
          actionType: "create_draft",
          metadata: {
            collectionId: target.collection.id,
            collectionName: target.collection.displayName,
            fieldMapping: target.mapping,
          },
        });
      }
    }

    const status =
      createdCount + updatedCount > 0
        ? skippedCount > 0
          ? "partial_success"
          : "completed"
        : "failed";

    if (status === "failed" && warnings.length === 0) {
      warnings.push("No Webflow CMS drafts were created.");
    }

    return await updateCmsDeploymentRun(run.id, {
      status,
      createdCount,
      updatedCount,
      skippedCount,
      previewLinks: dedupeLinks(previewLinks),
      warnings,
      errorMessage: status === "failed" ? warnings[0] ?? "CMS deployment failed." : null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Webflow CMS deployment failed.";
    return updateCmsDeploymentRun(run.id, {
      status: "failed",
      createdCount,
      updatedCount,
      skippedCount: skippedCount + Math.max(0, opts.content.length - createdCount - updatedCount - skippedCount),
      previewLinks: dedupeLinks(previewLinks),
      warnings: [...warnings, message],
      errorMessage: message,
    });
  }
}

async function resolveWebflowSite(opts: {
  accessToken: string;
  brandId: string;
  savedSiteId: string | null;
}): Promise<WebflowSiteSummary> {
  const sites = await listWebflowSites(opts.accessToken);
  const site = sites.find((candidate) => candidate.id === opts.savedSiteId) ?? sites[0];

  if (!site) {
    throw new Error("No Webflow sites were available for this account.");
  }

  await updateWebflowSiteConfig({
    brandId: opts.brandId,
    siteId: site.id,
    siteName: site.displayName,
    previewUrl: site.previewUrl,
  });

  return site;
}

async function selectCollectionTarget(
  accessToken: string,
  collections: WebflowCollection[],
  content: GeneratedContentRecord,
  cache: Map<string, WebflowCollection>,
): Promise<CollectionTarget | null> {
  const scored: CollectionTarget[] = [];

  for (const collectionSummary of collections) {
    const collection = await getCachedCollection(accessToken, collectionSummary.id, cache);
    const mapping = inferFieldMapping(collection.fields ?? []);
    if (!mapping) continue;

    const score = scoreCollection(collection, content, mapping);
    if (score >= MIN_COLLECTION_SCORE) {
      scored.push({ collection, mapping, score });
    }
  }

  return scored.sort((left, right) => right.score - left.score)[0] ?? null;
}

async function getCachedCollection(
  accessToken: string,
  collectionId: string,
  cache: Map<string, WebflowCollection>,
) {
  const cached = cache.get(collectionId);
  if (cached) return cached;
  const collection = await getWebflowCollection(accessToken, collectionId);
  cache.set(collectionId, collection);
  return collection;
}

async function getCachedItems(
  accessToken: string,
  collectionId: string,
  cache: Map<string, WebflowItem[]>,
) {
  const cached = cache.get(collectionId);
  if (cached) return cached;
  const items = await listWebflowItems(accessToken, collectionId);
  cache.set(collectionId, items);
  return items;
}

function inferFieldMapping(fields: WebflowField[]): FieldMapping | null {
  const editable = fields.filter((field) => field.isEditable);
  const title = findField(editable, ["name", "title", "headline", "question"]);
  const slug = findField(editable, ["slug"]);
  const body = findField(editable, ["body", "content", "rich-text", "post-body", "answer", "description", "copy"]);
  const excerpt = findField(editable, ["excerpt", "summary", "description", "meta-description"]);

  if (!title || !slug || !body) {
    return null;
  }

  const mappedSlugs = new Set([title.slug, slug.slug, body.slug, excerpt?.slug].filter(Boolean));
  const unsupportedRequiredFields = editable.filter(
    (field) =>
      field.isRequired &&
      !mappedSlugs.has(field.slug) &&
      !["PlainText", "PlainTextField"].includes(field.type),
  );

  if (unsupportedRequiredFields.length > 0) {
    return null;
  }

  return {
    title: title.slug,
    slug: slug.slug,
    body: body.slug,
    excerpt: excerpt?.slug === body.slug ? null : excerpt?.slug ?? null,
    requiredTextFields: editable
      .filter((field) => field.isRequired && !mappedSlugs.has(field.slug) && isPlainTextField(field))
      .map((field) => field.slug),
  };
}

function findField(fields: WebflowField[], names: string[]) {
  const normalizedNames = names.map(normalizeText);
  return fields.find((field) => {
    const candidates = [field.slug, field.displayName].map(normalizeText);
    return normalizedNames.some((name) => candidates.some((candidate) => candidate.includes(name)));
  });
}

function scoreCollection(collection: WebflowCollection, content: GeneratedContentRecord, mapping: FieldMapping) {
  const name = normalizeText(`${collection.displayName} ${collection.singularName}`);
  let score = 0;

  if (mapping.title && mapping.slug && mapping.body) score += 30;
  if (/(blog|article|post|learn|guide|resource|education|faq|help|support)/.test(name)) score += 30;
  if (content.content_type === "faq_snippet" && /(faq|help|question|support|learn)/.test(name)) score += 25;
  if (content.content_type === "product_interaction" && /(blog|article|guide|product|learn|resource)/.test(name)) {
    score += 25;
  }
  if (collection.fields?.some((field) => /rich/i.test(field.type))) score += 10;

  return score;
}

function findExistingItem(content: GeneratedContentRecord, items: WebflowItem[]) {
  const title = content.title ?? content.content_type;
  const slug = slugify(title);
  let best: { item: WebflowItem; score: number } | null = null;

  for (const item of items) {
    const itemTitle = String(item.fieldData.name ?? item.fieldData.title ?? "");
    const itemSlug = String(item.fieldData.slug ?? "");
    let score = 0;

    if (itemSlug && itemSlug === slug) score += 90;
    if (normalizeText(itemTitle) === normalizeText(title)) score += 90;
    if (normalizeText(itemTitle).includes(normalizeText(title)) || normalizeText(title).includes(normalizeText(itemTitle))) {
      score += 45;
    }

    if (!best || score > best.score) {
      best = { item, score };
    }
  }

  return best && best.score > 0 ? best : null;
}

function buildFieldData(
  content: GeneratedContentRecord,
  brand: BrandRecord,
  mapping: FieldMapping,
  existing?: WebflowItem,
) {
  const title = content.title ?? prettifyContentType(content.content_type);
  const fieldData: Record<string, unknown> = {
    ...(existing?.fieldData ?? {}),
    [mapping.title]: title,
    [mapping.slug]: slugify(title),
  };

  if (mapping.body) {
    fieldData[mapping.body] = contentToHtml(content);
  }

  if (mapping.excerpt) {
    fieldData[mapping.excerpt] = buildExcerpt(content.body);
  }

  for (const fieldSlug of mapping.requiredTextFields) {
    if (fieldData[fieldSlug]) continue;
    fieldData[fieldSlug] = getRequiredTextDefault(fieldSlug, content, brand);
  }

  return fieldData;
}

function isPlainTextField(field: WebflowField) {
  return ["PlainText", "PlainTextField"].includes(field.type);
}

function getRequiredTextDefault(fieldSlug: string, content: GeneratedContentRecord, brand: BrandRecord) {
  const normalized = normalizeText(fieldSlug);

  if (normalized.includes("author")) {
    return brand.brand_name;
  }

  if (normalized.includes("category") || normalized.includes("tag")) {
    return prettifyContentType(content.content_type);
  }

  return "SuppGo";
}

function buildExcerpt(body: string) {
  return body.replace(/\s+/g, " ").trim().slice(0, 180);
}

function prettifyContentType(value: string) {
  return value.replace(/_/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function normalizeText(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

function slugify(value: string) {
  return normalizeText(value).replace(/\s+/g, "-").slice(0, 80) || "suppgo-content";
}

function dedupeLinks(links: CmsDeploymentPreviewLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    if (seen.has(link.url)) return false;
    seen.add(link.url);
    return true;
  });
}
