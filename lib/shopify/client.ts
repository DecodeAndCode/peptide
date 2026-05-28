import "server-only";
import { paragraphsToHtml } from "@/lib/text";
import type { GeneratedContentRecord } from "@/types";

export const SHOPIFY_API_VERSION = "2025-04";
export const SHOPIFY_METAFIELD_NAMESPACE = "suppgo";
export const SHOPIFY_METAFIELD_KEYS = {
  body: "proposed_body_html",
  seoTitle: "proposed_seo_title",
  seoDescription: "proposed_seo_description",
} as const;

export interface ShopifyShop {
  id: string;
  name: string;
  primaryDomain: { host: string; url: string };
  myshopifyDomain: string;
}

export interface ShopifyProductSummary {
  id: string;
  title: string;
  handle: string;
  status: "ACTIVE" | "ARCHIVED" | "DRAFT";
}

export interface ShopifyBlogSummary {
  id: string;
  title: string;
  handle: string;
}

export interface ShopifyArticleDraft {
  id: string;
  title: string;
  handle: string | null;
  blogId: string;
  blogHandle: string | null;
  publishedAt: string | null;
}

export interface ShopifyPageDraft {
  id: string;
  title: string;
  handle: string | null;
  isPublished: boolean;
}

export interface ShopifyMetafieldDraft {
  ownerId: string;
  namespace: string;
  key: string;
  type: "multi_line_text_field" | "single_line_text_field";
  value: string;
}

export interface ShopifyUserError {
  field?: string[] | null;
  message: string;
  code?: string | null;
}

function buildAdminBaseUrl(shopDomain: string) {
  return `https://${shopDomain}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;
}

export async function shopifyGraphqlRequest<T>(opts: {
  accessToken: string;
  shopDomain: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<T> {
  const res = await fetch(buildAdminBaseUrl(opts.shopDomain), {
    method: "POST",
    headers: {
      "X-Shopify-Access-Token": opts.accessToken,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query: opts.query, variables: opts.variables ?? {} }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Shopify API request failed (${res.status}): ${text || res.statusText}`);
  }

  const json = (await res.json()) as { data?: T; errors?: Array<{ message: string }> };
  if (json.errors && json.errors.length > 0) {
    throw new Error(`Shopify GraphQL error: ${json.errors.map((e) => e.message).join("; ")}`);
  }
  if (!json.data) {
    throw new Error("Shopify GraphQL response missing data field.");
  }
  return json.data;
}

const SHOP_QUERY = `
  query SuppgoShop {
    shop {
      id
      name
      myshopifyDomain
      primaryDomain { host url }
    }
  }
`;

export async function getShopifyShop(accessToken: string, shopDomain: string): Promise<ShopifyShop> {
  const data = await shopifyGraphqlRequest<{ shop: ShopifyShop }>({
    accessToken,
    shopDomain,
    query: SHOP_QUERY,
  });
  return data.shop;
}

const PRODUCTS_QUERY = `
  query SuppgoProducts($first: Int!, $after: String) {
    products(first: $first, after: $after, query: "status:active OR status:draft") {
      edges {
        cursor
        node {
          id
          title
          handle
          status
        }
      }
      pageInfo { hasNextPage endCursor }
    }
  }
`;

export async function listShopifyProducts(
  accessToken: string,
  shopDomain: string,
  limit = 100,
): Promise<ShopifyProductSummary[]> {
  const items: ShopifyProductSummary[] = [];
  let after: string | null = null;

  while (items.length < limit) {
    const data: {
      products: {
        edges: Array<{ cursor: string; node: ShopifyProductSummary }>;
        pageInfo: { hasNextPage: boolean; endCursor: string | null };
      };
    } = await shopifyGraphqlRequest({
      accessToken,
      shopDomain,
      query: PRODUCTS_QUERY,
      variables: { first: Math.min(50, limit - items.length), after },
    });
    items.push(...data.products.edges.map((edge) => edge.node));
    if (!data.products.pageInfo.hasNextPage) break;
    after = data.products.pageInfo.endCursor;
    if (!after) break;
  }

  return items.slice(0, limit);
}

const BLOGS_QUERY = `
  query SuppgoBlogs($first: Int!) {
    blogs(first: $first) {
      edges {
        node { id title handle }
      }
    }
  }
`;

export async function listShopifyBlogs(accessToken: string, shopDomain: string): Promise<ShopifyBlogSummary[]> {
  const data = await shopifyGraphqlRequest<{
    blogs: { edges: Array<{ node: ShopifyBlogSummary }> };
  }>({
    accessToken,
    shopDomain,
    query: BLOGS_QUERY,
    variables: { first: 25 },
  });
  return data.blogs.edges.map((edge) => edge.node);
}

const METAFIELDS_SET_MUTATION = `
  mutation SuppgoMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id namespace key value ownerType }
      userErrors { field message code }
    }
  }
`;

export async function setShopifyMetafields(opts: {
  accessToken: string;
  shopDomain: string;
  metafields: ShopifyMetafieldDraft[];
}): Promise<{ ids: string[]; userErrors: ShopifyUserError[] }> {
  const data = await shopifyGraphqlRequest<{
    metafieldsSet: {
      metafields: Array<{ id: string }>;
      userErrors: ShopifyUserError[];
    };
  }>({
    accessToken: opts.accessToken,
    shopDomain: opts.shopDomain,
    query: METAFIELDS_SET_MUTATION,
    variables: {
      metafields: opts.metafields.map((mf) => ({
        ownerId: mf.ownerId,
        namespace: mf.namespace,
        key: mf.key,
        type: mf.type,
        value: mf.value,
      })),
    },
  });

  return {
    ids: data.metafieldsSet.metafields.map((m) => m.id),
    userErrors: data.metafieldsSet.userErrors ?? [],
  };
}

const ARTICLE_CREATE_MUTATION = `
  mutation SuppgoArticleCreate($article: ArticleCreateInput!) {
    articleCreate(article: $article) {
      article { id title handle blog { id handle } publishedAt }
      userErrors { field message code }
    }
  }
`;

export async function createShopifyDraftArticle(opts: {
  accessToken: string;
  shopDomain: string;
  blogId: string;
  title: string;
  bodyHtml: string;
  summary?: string | null;
  authorName?: string;
}): Promise<{ article: ShopifyArticleDraft | null; userErrors: ShopifyUserError[] }> {
  const data = await shopifyGraphqlRequest<{
    articleCreate: {
      article: {
        id: string;
        title: string;
        handle: string | null;
        blog: { id: string; handle: string | null };
        publishedAt: string | null;
      } | null;
      userErrors: ShopifyUserError[];
    };
  }>({
    accessToken: opts.accessToken,
    shopDomain: opts.shopDomain,
    query: ARTICLE_CREATE_MUTATION,
    variables: {
      article: {
        blogId: opts.blogId,
        title: opts.title,
        body: opts.bodyHtml,
        summary: opts.summary ?? null,
        isPublished: false,
        author: { name: opts.authorName?.trim() || "SuppGO" },
      },
    },
  });

  const article = data.articleCreate.article;
  return {
    article: article
      ? {
          id: article.id,
          title: article.title,
          handle: article.handle,
          blogId: article.blog.id,
          blogHandle: article.blog.handle,
          publishedAt: article.publishedAt,
        }
      : null,
    userErrors: data.articleCreate.userErrors ?? [],
  };
}

const PAGE_CREATE_MUTATION = `
  mutation SuppgoPageCreate($page: PageCreateInput!) {
    pageCreate(page: $page) {
      page { id title handle isPublished }
      userErrors { field message code }
    }
  }
`;

export async function createShopifyDraftPage(opts: {
  accessToken: string;
  shopDomain: string;
  title: string;
  bodyHtml: string;
}): Promise<{ page: ShopifyPageDraft | null; userErrors: ShopifyUserError[] }> {
  const data = await shopifyGraphqlRequest<{
    pageCreate: {
      page: ShopifyPageDraft | null;
      userErrors: ShopifyUserError[];
    };
  }>({
    accessToken: opts.accessToken,
    shopDomain: opts.shopDomain,
    query: PAGE_CREATE_MUTATION,
    variables: {
      page: {
        title: opts.title,
        body: opts.bodyHtml,
        isPublished: false,
      },
    },
  });

  return {
    page: data.pageCreate.page,
    userErrors: data.pageCreate.userErrors ?? [],
  };
}

export function buildShopifyAdminUrl(shopDomain: string) {
  return `https://${shopDomain}/admin`;
}

export function buildShopifyProductAdminUrl(shopDomain: string, productGid: string) {
  const numericId = extractNumericId(productGid);
  if (!numericId) return buildShopifyAdminUrl(shopDomain);
  return `https://${shopDomain}/admin/products/${numericId}`;
}

export function buildShopifyArticleAdminUrl(shopDomain: string, blogGid: string, articleGid: string) {
  const blogId = extractNumericId(blogGid);
  const articleId = extractNumericId(articleGid);
  if (!blogId || !articleId) return `${buildShopifyAdminUrl(shopDomain)}/articles`;
  return `https://${shopDomain}/admin/blogs/${blogId}/articles/${articleId}`;
}

export function buildShopifyPageAdminUrl(shopDomain: string, pageGid: string) {
  const numericId = extractNumericId(pageGid);
  if (!numericId) return `${buildShopifyAdminUrl(shopDomain)}/pages`;
  return `https://${shopDomain}/admin/pages/${numericId}`;
}

export function extractNumericId(gid: string | null | undefined): string | null {
  if (!gid) return null;
  const match = gid.match(/\/(\d+)(?:\?|$)/);
  return match ? match[1] : null;
}

export function normalizeShopDomain(input: string): string {
  return input.trim().toLowerCase().replace(/^https?:\/\//, "").replace(/\/+$/, "");
}

const SHOP_DOMAIN_PATTERN = /^[a-z0-9][a-z0-9-]*\.myshopify\.com$/;

export function isValidShopDomain(input: string): boolean {
  return SHOP_DOMAIN_PATTERN.test(normalizeShopDomain(input));
}

export function contentToHtml(content: GeneratedContentRecord): string {
  return paragraphsToHtml(content.body);
}
