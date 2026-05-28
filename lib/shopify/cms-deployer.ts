import "server-only";
import {
  SHOPIFY_METAFIELD_KEYS,
  SHOPIFY_METAFIELD_NAMESPACE,
  buildShopifyAdminUrl,
  buildShopifyArticleAdminUrl,
  buildShopifyPageAdminUrl,
  buildShopifyProductAdminUrl,
  type ShopifyProductSummary,
} from "@/lib/shopify/client";
import {
  createDryRunAdapter,
  createHttpAdapter,
  shouldUseDryRun,
  type ShopifyAdapter,
} from "@/lib/shopify/adapter";
import { buildExcerpt, normalizeText, paragraphsToHtml, prettifyContentType, slugify } from "@/lib/text";
import {
  createCmsDeploymentRun,
  getDecryptedAccessToken,
  getShopifyIntegration,
  recordContentDeployment,
  updateCmsDeploymentRun,
  updateShopifyShopConfig,
} from "@/lib/integrations";
import type {
  BrandRecord,
  CmsDeploymentPreviewLink,
  CmsDeploymentRunRecord,
  GeneratedContentRecord,
} from "@/types";

interface DeployCycleOptions {
  brand: BrandRecord;
  cycleId: string;
  content: GeneratedContentRecord[];
  dryRun?: boolean;
}

export const MIN_PRODUCT_MATCH_SCORE = 85;

type ContentRoute =
  | { kind: "skip"; reason: string }
  | { kind: "article" }
  | { kind: "page" }
  | { kind: "product_metafield" };

export function routeContent(content: GeneratedContentRecord): ContentRoute {
  const type = content.content_type as string;

  if (type === "llms_txt") {
    return { kind: "skip", reason: "Shopify deployment skips llms_txt — host it from your storefront instead." };
  }
  if (type === "product_description") {
    return { kind: "product_metafield" };
  }
  if (type === "landing_page_section") {
    return { kind: "page" };
  }
  if (type === "faq_snippet" || type === "product_interaction" || type === "blog_post") {
    return { kind: "article" };
  }
  return { kind: "skip", reason: `Shopify deployment has no handler for content_type "${type}".` };
}

export async function deployCycleToShopify(opts: DeployCycleOptions): Promise<CmsDeploymentRunRecord> {
  const dryRun = shouldUseDryRun({ dryRun: opts.dryRun });

  let adapter: ShopifyAdapter;
  let persistShopConfig = true;

  if (dryRun) {
    adapter = createDryRunAdapter();
    persistShopConfig = false;
  } else {
    const integration = await getShopifyIntegration(opts.brand.id);
    if (!integration || integration.status !== "active") {
      throw new Error("Shopify is not connected. Connect it in Settings first.");
    }
    const shopDomain = integration.credentials.shop_domain;
    if (!shopDomain) {
      throw new Error("Shopify integration is missing the shop domain. Reconnect Shopify to continue.");
    }
    adapter = createHttpAdapter({
      accessToken: getDecryptedAccessToken(integration),
      shopDomain,
    });
  }

  const run = await createCmsDeploymentRun({
    cycleId: opts.cycleId,
    brandId: opts.brand.id,
    integrationType: "shopify",
  });

  const warnings: string[] = [];
  const previewLinks: CmsDeploymentPreviewLink[] = [];
  let createdCount = 0;
  let updatedCount = 0;
  let skippedCount = 0;

  try {
    const shop = await adapter.getShop();
    const shopDomain = shop.myshopifyDomain || adapter.shopDomain;
    const adminUrl = buildShopifyAdminUrl(shopDomain);

    previewLinks.push({
      label: "Open Shopify Admin",
      url: adminUrl,
      type: "shopify_admin",
    });

    if (persistShopConfig) {
      const blogs = await adapter.listBlogs();
      const primaryBlog = blogs[0] ?? null;
      await updateShopifyShopConfig({
        brandId: opts.brand.id,
        shopDomain,
        blogId: primaryBlog?.id ?? null,
        blogHandle: primaryBlog?.handle ?? null,
      });
    }

    const blogs = await adapter.listBlogs();
    const primaryBlog = blogs[0] ?? null;
    const products = await adapter.listProducts();

    for (const item of opts.content) {
      const route = routeContent(item);

      if (route.kind === "skip") {
        skippedCount += 1;
        warnings.push(`Skipped "${item.title ?? item.content_type}" — ${route.reason}`);
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "shopify",
          externalUrl: adminUrl,
          status: "failed",
          deploymentRunId: run.id,
          actionType: "skipped",
          errorMessage: route.reason,
        });
        continue;
      }

      if (route.kind === "product_metafield") {
        const match = findProductMatch(item, products);
        if (!match || match.score < MIN_PRODUCT_MATCH_SCORE) {
          skippedCount += 1;
          const reason = `No Shopify product matched "${item.title ?? "product description"}" with high confidence.`;
          warnings.push(reason);
          await recordContentDeployment({
            contentId: item.id,
            brandId: opts.brand.id,
            integrationType: "shopify",
            externalUrl: adminUrl,
            status: "failed",
            deploymentRunId: run.id,
            actionType: "skipped",
            errorMessage: reason,
            metadata: match ? { matchScore: match.score, productId: match.product.id } : {},
          });
          continue;
        }

        const result = await adapter.setMetafields(buildProductMetafields(item, match.product));
        if (result.userErrors.length > 0) {
          skippedCount += 1;
          const reason = result.userErrors.map((e) => e.message).join("; ");
          warnings.push(`Shopify rejected metafield write for "${match.product.title}": ${reason}`);
          await recordContentDeployment({
            contentId: item.id,
            brandId: opts.brand.id,
            integrationType: "shopify",
            externalUrl: buildShopifyProductAdminUrl(shopDomain, match.product.id),
            status: "failed",
            deploymentRunId: run.id,
            actionType: "skipped",
            errorMessage: reason,
            metadata: { productId: match.product.id, matchScore: match.score },
          });
          continue;
        }

        const productUrl = buildShopifyProductAdminUrl(shopDomain, match.product.id);
        updatedCount += 1;
        previewLinks.push({
          label: `Updated: ${match.product.title} (proposed metafields)`,
          url: productUrl,
          type: "shopify_product",
        });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "shopify",
          externalUrl: productUrl,
          status: "deployed",
          deploymentRunId: run.id,
          externalId: match.product.id,
          actionType: "update_draft",
          metadata: {
            productId: match.product.id,
            productTitle: match.product.title,
            matchScore: match.score,
            metafieldNamespace: SHOPIFY_METAFIELD_NAMESPACE,
          },
        });
        continue;
      }

      if (route.kind === "article") {
        if (!primaryBlog) {
          skippedCount += 1;
          const reason = "No Shopify blog is available. Create one in Shopify Admin first, then redeploy.";
          warnings.push(reason);
          await recordContentDeployment({
            contentId: item.id,
            brandId: opts.brand.id,
            integrationType: "shopify",
            externalUrl: adminUrl,
            status: "failed",
            deploymentRunId: run.id,
            actionType: "skipped",
            errorMessage: reason,
          });
          continue;
        }

        const title = item.title ?? prettifyContentType(item.content_type);
        const result = await adapter.createDraftArticle({
          blogId: primaryBlog.id,
          title,
          bodyHtml: paragraphsToHtml(item.body),
          summary: buildExcerpt(item.body),
        });

        if (!result.article || result.userErrors.length > 0) {
          skippedCount += 1;
          const reason =
            result.userErrors.length > 0
              ? result.userErrors.map((e) => e.message).join("; ")
              : "Shopify rejected the article without returning a payload.";
          warnings.push(`Failed to create draft article for "${title}": ${reason}`);
          await recordContentDeployment({
            contentId: item.id,
            brandId: opts.brand.id,
            integrationType: "shopify",
            externalUrl: adminUrl,
            status: "failed",
            deploymentRunId: run.id,
            actionType: "skipped",
            errorMessage: reason,
          });
          continue;
        }

        const articleUrl = buildShopifyArticleAdminUrl(shopDomain, primaryBlog.id, result.article.id);
        createdCount += 1;
        previewLinks.push({
          label: `Created: ${title} (draft article)`,
          url: articleUrl,
          type: "shopify_article",
        });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "shopify",
          externalUrl: articleUrl,
          status: "deployed",
          deploymentRunId: run.id,
          externalId: result.article.id,
          actionType: "create_draft",
          metadata: {
            blogId: primaryBlog.id,
            blogHandle: primaryBlog.handle,
            articleHandle: result.article.handle,
          },
        });
        continue;
      }

      if (route.kind === "page") {
        const title = item.title ?? prettifyContentType(item.content_type);
        const result = await adapter.createDraftPage({
          title,
          bodyHtml: paragraphsToHtml(item.body),
        });

        if (!result.page || result.userErrors.length > 0) {
          skippedCount += 1;
          const reason =
            result.userErrors.length > 0
              ? result.userErrors.map((e) => e.message).join("; ")
              : "Shopify rejected the page without returning a payload.";
          warnings.push(`Failed to create draft page for "${title}": ${reason}`);
          await recordContentDeployment({
            contentId: item.id,
            brandId: opts.brand.id,
            integrationType: "shopify",
            externalUrl: adminUrl,
            status: "failed",
            deploymentRunId: run.id,
            actionType: "skipped",
            errorMessage: reason,
          });
          continue;
        }

        const pageUrl = buildShopifyPageAdminUrl(shopDomain, result.page.id);
        createdCount += 1;
        previewLinks.push({
          label: `Created: ${title} (draft page)`,
          url: pageUrl,
          type: "shopify_page",
        });
        await recordContentDeployment({
          contentId: item.id,
          brandId: opts.brand.id,
          integrationType: "shopify",
          externalUrl: pageUrl,
          status: "deployed",
          deploymentRunId: run.id,
          externalId: result.page.id,
          actionType: "create_draft",
          metadata: { handle: result.page.handle },
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
          "No Shopify drafts were created. Make sure your Shopify store has at least one blog and matching products."
        : null;

    if (status !== "failed") {
      warnings.unshift(
        "Shopify changes are saved as drafts (unpublished articles, unpublished pages, or `suppgo` namespaced product metafields). Review and publish them in Shopify Admin before they appear on the live store.",
      );
      if (dryRun) {
        warnings.unshift(
          "DRY RUN — no real Shopify calls were made. Drafts were simulated with in-memory fixtures.",
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
    const message = error instanceof Error ? error.message : "Shopify CMS deployment failed.";
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

export function findProductMatch(
  content: GeneratedContentRecord,
  products: ShopifyProductSummary[],
): { product: ShopifyProductSummary; score: number } | null {
  const title = content.title ?? "";
  if (!title.trim()) return null;
  const normalizedTitle = normalizeText(title);
  const titleSlug = slugify(title);
  let best: { product: ShopifyProductSummary; score: number } | null = null;

  for (const product of products) {
    let score = 0;
    const productTitleNorm = normalizeText(product.title);
    const productHandle = product.handle.toLowerCase();

    if (productHandle && productHandle === titleSlug) score += 90;
    if (productTitleNorm === normalizedTitle) score += 90;
    if (
      productTitleNorm.includes(normalizedTitle) ||
      normalizedTitle.includes(productTitleNorm)
    ) {
      score += 45;
    }

    if (!best || score > best.score) {
      best = { product, score };
    }
  }

  return best && best.score > 0 ? best : null;
}

export function buildProductMetafields(content: GeneratedContentRecord, product: ShopifyProductSummary) {
  return [
    {
      ownerId: product.id,
      namespace: SHOPIFY_METAFIELD_NAMESPACE,
      key: SHOPIFY_METAFIELD_KEYS.body,
      type: "multi_line_text_field" as const,
      value: paragraphsToHtml(content.body),
    },
    {
      ownerId: product.id,
      namespace: SHOPIFY_METAFIELD_NAMESPACE,
      key: SHOPIFY_METAFIELD_KEYS.seoTitle,
      type: "single_line_text_field" as const,
      value: content.title ?? product.title,
    },
    {
      ownerId: product.id,
      namespace: SHOPIFY_METAFIELD_NAMESPACE,
      key: SHOPIFY_METAFIELD_KEYS.seoDescription,
      type: "multi_line_text_field" as const,
      value: buildExcerpt(content.body),
    },
  ];
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
