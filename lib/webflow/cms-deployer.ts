import "server-only";
import {
  buildWebflowDashboardUrl,
  type WebflowCollection,
  type WebflowField,
  type WebflowItem,
} from "@/lib/webflow/client";
import {
  createDryRunAdapter,
  createHttpAdapter,
  shouldUseDryRun,
  type WebflowAdapter,
} from "@/lib/webflow/adapter";
import {
  buildExcerpt,
  normalizeText,
  paragraphsToHtml,
  prettifyContentType,
  slugify,
} from "@/lib/text";
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
  dryRun?: boolean;
}

export interface FieldMapping {
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
  const dryRun = shouldUseDryRun({ dryRun: opts.dryRun });

  let adapter: WebflowAdapter;
  let savedSiteId: string | null = null;
  let persistSiteConfig = true;

  if (dryRun) {
    adapter = createDryRunAdapter();
    persistSiteConfig = false;
  } else {
    const integration = await getWebflowIntegration(opts.brand.id);
    if (!integration || integration.status !== "active") {
      throw new Error("Webflow is not connected. Connect it in Settings first.");
    }
    adapter = createHttpAdapter(getDecryptedAccessToken(integration));
    savedSiteId = integration.credentials.site_id ?? null;
  }

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
      adapter,
      brandId: opts.brand.id,
      savedSiteId,
      persistSiteConfig,
    });

    const dashboardUrl = buildWebflowDashboardUrl(site.shortName);
    previewLinks.push({
      label: "Open Webflow Designer (CMS)",
      url: dashboardUrl,
      type: "webflow_dashboard",
    });

    const collections = await adapter.listCollections(site.id);
    const contentToDeploy = opts.content.filter((item) => item.content_type !== "llms_txt");

    if (contentToDeploy.length === 0) {
      warnings.push("No CMS-ready generated content was available for this cycle.");
    }

    const collectionCache = new Map<string, WebflowCollection>();
    const itemCache = new Map<string, WebflowItem[]>();

    for (const item of contentToDeploy) {
      const target = await selectCollectionTarget(adapter, collections, item, collectionCache);

      if (!target) {
        skippedCount += 1;
        const message = `Skipped "${item.title ?? item.content_type}" because no safe Webflow CMS collection match was found.`;
        warnings.push(message);
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: dashboardUrl,
          status: "failed",
          deploymentRunId: run.id,
          actionType: "skipped",
          errorMessage: message,
        });
        continue;
      }

      const items = await getCachedItems(adapter, target.collection.id, itemCache);
      const existing = findExistingItem(item, items);
      const fieldData = buildFieldData(item, opts.brand, target.mapping, existing?.item);

      if (existing && existing.score >= MIN_UPDATE_MATCH_SCORE) {
        const result = await adapter.updateDraftItem({
          collectionId: target.collection.id,
          itemId: existing.item.id,
          fieldData,
        });
        updatedCount += 1;
        previewLinks.push({
          label: buildDraftReviewLabel("Updated", item, target.collection.displayName),
          url: dashboardUrl,
          type: "cms_item",
        });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: dashboardUrl,
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
          externalUrl: dashboardUrl,
          status: "failed",
          deploymentRunId: run.id,
          actionType: "skipped",
          errorMessage: message,
          metadata: { matchScore: existing.score, collectionId: target.collection.id },
        });
      } else {
        const result = await adapter.createDraftItem({
          collectionId: target.collection.id,
          fieldData,
        });
        createdCount += 1;
        previewLinks.push({
          label: buildDraftReviewLabel("Created", item, target.collection.displayName),
          url: dashboardUrl,
          type: "cms_item",
        });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "webflow",
          externalUrl: dashboardUrl,
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

    const errorMessage =
      status === "failed"
        ? warnings[0] ??
          "No Webflow CMS drafts were created. Make sure your Webflow site has at least one Collection that matches the generated content."
        : null;

    if (status !== "failed") {
      warnings.unshift(
        "Webflow changes are saved as drafts. Review and publish them in the Webflow CMS before they appear on the live site.",
      );
      if (dryRun) {
        warnings.unshift(
          "DRY RUN — no real Webflow calls were made. Drafts were simulated with in-memory fixtures.",
        );
      }
    }

    return await updateCmsDeploymentRun(run.id, {
      status,
      createdCount,
      updatedCount,
      skippedCount,
      previewLinks: dedupeLinks(previewLinks),
      warnings,
      errorMessage,
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
  adapter: WebflowAdapter;
  brandId: string;
  savedSiteId: string | null;
  persistSiteConfig: boolean;
}): Promise<WebflowSiteSummary> {
  const sites = await opts.adapter.listSites();
  const site = sites.find((candidate) => candidate.id === opts.savedSiteId) ?? sites[0];

  if (!site) {
    throw new Error("No Webflow sites were available for this account.");
  }

  if (opts.persistSiteConfig) {
    await updateWebflowSiteConfig({
      brandId: opts.brandId,
      siteId: site.id,
      siteName: site.displayName,
      previewUrl: site.previewUrl,
    });
  }

  return site;
}

async function selectCollectionTarget(
  adapter: WebflowAdapter,
  collections: WebflowCollection[],
  content: GeneratedContentRecord,
  cache: Map<string, WebflowCollection>,
): Promise<CollectionTarget | null> {
  const scored: CollectionTarget[] = [];

  for (const collectionSummary of collections) {
    const collection = await getCachedCollection(adapter, collectionSummary.id, cache);
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
  adapter: WebflowAdapter,
  collectionId: string,
  cache: Map<string, WebflowCollection>,
) {
  const cached = cache.get(collectionId);
  if (cached) return cached;
  const collection = await adapter.getCollection(collectionId);
  cache.set(collectionId, collection);
  return collection;
}

async function getCachedItems(
  adapter: WebflowAdapter,
  collectionId: string,
  cache: Map<string, WebflowItem[]>,
) {
  const cached = cache.get(collectionId);
  if (cached) return cached;
  const items = await adapter.listItems(collectionId);
  cache.set(collectionId, items);
  return items;
}

export function inferFieldMapping(fields: WebflowField[]): FieldMapping | null {
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

export function findField(fields: WebflowField[], names: string[]) {
  const normalizedNames = names.map(normalizeText);
  return fields.find((field) => {
    const candidates = [field.slug, field.displayName].map(normalizeText);
    return normalizedNames.some((name) => candidates.some((candidate) => candidate.includes(name)));
  });
}

export function scoreCollection(collection: WebflowCollection, content: GeneratedContentRecord, mapping: FieldMapping) {
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

export function findExistingItem(content: GeneratedContentRecord, items: WebflowItem[]) {
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

export function buildFieldData(
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
    fieldData[mapping.body] = paragraphsToHtml(content.body);
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

export function isPlainTextField(field: WebflowField) {
  return ["PlainText", "PlainTextField"].includes(field.type);
}

export function getRequiredTextDefault(fieldSlug: string, content: GeneratedContentRecord, brand: BrandRecord) {
  const normalized = normalizeText(fieldSlug);

  if (normalized.includes("author")) {
    return brand.brand_name;
  }

  if (normalized.includes("category") || normalized.includes("tag")) {
    return prettifyContentType(content.content_type);
  }

  return "SuppGo";
}

function buildDraftReviewLabel(action: "Created" | "Updated", content: GeneratedContentRecord, collectionName: string) {
  return `${action}: ${content.title ?? prettifyContentType(content.content_type)} in ${collectionName}`;
}

function dedupeLinks(links: CmsDeploymentPreviewLink[]) {
  const seen = new Set<string>();
  return links.filter((link) => {
    const key = `${link.type}:${link.label}:${link.url}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
