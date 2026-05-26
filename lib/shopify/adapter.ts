import { randomUUID } from "crypto";
import {
  createShopifyDraftArticle,
  createShopifyDraftPage,
  getShopifyShop,
  listShopifyBlogs,
  listShopifyProducts,
  setShopifyMetafields,
  type ShopifyArticleDraft,
  type ShopifyBlogSummary,
  type ShopifyMetafieldDraft,
  type ShopifyPageDraft,
  type ShopifyProductSummary,
  type ShopifyShop,
  type ShopifyUserError,
} from "@/lib/shopify/client";

export interface ShopifyAdapter {
  readonly isDryRun: boolean;
  readonly shopDomain: string;
  getShop(): Promise<ShopifyShop>;
  listProducts(): Promise<ShopifyProductSummary[]>;
  listBlogs(): Promise<ShopifyBlogSummary[]>;
  setMetafields(metafields: ShopifyMetafieldDraft[]): Promise<{ ids: string[]; userErrors: ShopifyUserError[] }>;
  createDraftArticle(opts: {
    blogId: string;
    title: string;
    bodyHtml: string;
    summary?: string | null;
  }): Promise<{ article: ShopifyArticleDraft | null; userErrors: ShopifyUserError[] }>;
  createDraftPage(opts: {
    title: string;
    bodyHtml: string;
  }): Promise<{ page: ShopifyPageDraft | null; userErrors: ShopifyUserError[] }>;
}

export function createHttpAdapter(opts: { accessToken: string; shopDomain: string }): ShopifyAdapter {
  const { accessToken, shopDomain } = opts;
  return {
    isDryRun: false,
    shopDomain,
    getShop: () => getShopifyShop(accessToken, shopDomain),
    listProducts: () => listShopifyProducts(accessToken, shopDomain),
    listBlogs: () => listShopifyBlogs(accessToken, shopDomain),
    setMetafields: (metafields) => setShopifyMetafields({ accessToken, shopDomain, metafields }),
    createDraftArticle: ({ blogId, title, bodyHtml, summary }) =>
      createShopifyDraftArticle({ accessToken, shopDomain, blogId, title, bodyHtml, summary }),
    createDraftPage: ({ title, bodyHtml }) =>
      createShopifyDraftPage({ accessToken, shopDomain, title, bodyHtml }),
  };
}

export interface ShopifyDryRunFixture {
  shop: ShopifyShop;
  products: ShopifyProductSummary[];
  blogs: ShopifyBlogSummary[];
}

const DEFAULT_DRY_RUN_FIXTURE: ShopifyDryRunFixture = {
  shop: {
    id: "gid://shopify/Shop/1",
    name: "SuppGO Dry Run Shop",
    myshopifyDomain: "suppgo-dryrun.myshopify.com",
    primaryDomain: { host: "suppgo-dryrun.myshopify.com", url: "https://suppgo-dryrun.myshopify.com" },
  },
  products: [
    {
      id: "gid://shopify/Product/100001",
      title: "Magnesium Glycinate 400mg",
      handle: "magnesium-glycinate-400mg",
      status: "ACTIVE",
    },
    {
      id: "gid://shopify/Product/100002",
      title: "Vitamin D3 5000 IU",
      handle: "vitamin-d3-5000-iu",
      status: "ACTIVE",
    },
    {
      id: "gid://shopify/Product/100003",
      title: "Daily Greens Powder",
      handle: "daily-greens-powder",
      status: "DRAFT",
    },
  ],
  blogs: [
    { id: "gid://shopify/Blog/200001", title: "News", handle: "news" },
  ],
};

export function createDryRunAdapter(
  shopDomain = "suppgo-dryrun.myshopify.com",
  fixture: ShopifyDryRunFixture = DEFAULT_DRY_RUN_FIXTURE,
): ShopifyAdapter {
  const articles: ShopifyArticleDraft[] = [];
  const pages: ShopifyPageDraft[] = [];
  const metafields: ShopifyMetafieldDraft[] = [];

  return {
    isDryRun: true,
    shopDomain,
    async getShop() {
      return fixture.shop;
    },
    async listProducts() {
      return fixture.products;
    },
    async listBlogs() {
      return fixture.blogs;
    },
    async setMetafields(input) {
      const ids: string[] = [];
      for (const mf of input) {
        metafields.push(mf);
        ids.push(`gid://shopify/Metafield/${randomUUID()}`);
      }
      return { ids, userErrors: [] };
    },
    async createDraftArticle({ blogId, title, bodyHtml }) {
      const blog = fixture.blogs.find((b) => b.id === blogId) ?? fixture.blogs[0];
      const article: ShopifyArticleDraft = {
        id: `gid://shopify/Article/${randomUUID()}`,
        title,
        handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        blogId,
        blogHandle: blog?.handle ?? null,
        publishedAt: null,
      };
      articles.push(article);
      void bodyHtml;
      return { article, userErrors: [] };
    },
    async createDraftPage({ title, bodyHtml }) {
      const page: ShopifyPageDraft = {
        id: `gid://shopify/Page/${randomUUID()}`,
        title,
        handle: title.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, ""),
        isPublished: false,
      };
      pages.push(page);
      void bodyHtml;
      return { page, userErrors: [] };
    },
  };
}

export function shouldUseDryRun(opts: { dryRun?: boolean }): boolean {
  if (opts.dryRun === true) return true;
  return process.env.SUPPGO_CMS_DRY_RUN === "1" || process.env.SUPPGO_CMS_DRY_RUN === "true";
}

export function isDryRunAllowedInProduction(): boolean {
  return (
    process.env.SUPPGO_ALLOW_DRY_RUN_PROD === "1" ||
    process.env.SUPPGO_ALLOW_DRY_RUN_PROD === "true"
  );
}
