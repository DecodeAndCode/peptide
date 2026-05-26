import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  SHOPIFY_API_VERSION,
  SHOPIFY_METAFIELD_KEYS,
  SHOPIFY_METAFIELD_NAMESPACE,
  buildShopifyAdminUrl,
  buildShopifyArticleAdminUrl,
  buildShopifyPageAdminUrl,
  buildShopifyProductAdminUrl,
  contentToHtml,
  createShopifyDraftArticle,
  createShopifyDraftPage,
  extractNumericId,
  getShopifyShop,
  isValidShopDomain,
  listShopifyBlogs,
  listShopifyProducts,
  normalizeShopDomain,
  setShopifyMetafields,
  shopifyGraphqlRequest,
} from "@/lib/shopify/client";
import type { GeneratedContentRecord } from "@/types";

type FetchMock = ReturnType<typeof vi.fn>;

let fetchMock: FetchMock;

function jsonResponse(body: unknown, init: { status?: number } = {}) {
  return {
    ok: (init.status ?? 200) < 400,
    status: init.status ?? 200,
    statusText: init.status === 401 ? "Unauthorized" : "OK",
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

beforeEach(() => {
  fetchMock = vi.fn();
  vi.stubGlobal("fetch", fetchMock);
});

afterEach(() => {
  vi.unstubAllGlobals();
});

const SHOP_DOMAIN = "suppgo-test.myshopify.com";
const GRAPHQL_URL = `https://${SHOP_DOMAIN}/admin/api/${SHOPIFY_API_VERSION}/graphql.json`;

describe("normalizeShopDomain", () => {
  it("strips protocol, trailing slash, and lowercases", () => {
    expect(normalizeShopDomain("HTTPS://Suppgo-Test.myshopify.com/")).toBe(SHOP_DOMAIN);
    expect(normalizeShopDomain(" suppgo-test.myshopify.com ")).toBe(SHOP_DOMAIN);
  });
});

describe("isValidShopDomain", () => {
  it("accepts canonical *.myshopify.com hosts", () => {
    expect(isValidShopDomain("suppgo-test.myshopify.com")).toBe(true);
    expect(isValidShopDomain("https://suppgo-test.myshopify.com/")).toBe(true);
  });

  it("rejects apex and custom domains", () => {
    expect(isValidShopDomain("myshopify.com")).toBe(false);
    expect(isValidShopDomain("shop.example.com")).toBe(false);
    expect(isValidShopDomain("-bad.myshopify.com")).toBe(false);
    expect(isValidShopDomain("bad..myshopify.com")).toBe(false);
  });
});

describe("extractNumericId", () => {
  it("returns the numeric id from a Shopify GID", () => {
    expect(extractNumericId("gid://shopify/Product/123456789")).toBe("123456789");
    expect(extractNumericId("gid://shopify/Article/987?variant=1")).toBe("987");
  });

  it("returns null when gid is missing or malformed", () => {
    expect(extractNumericId(null)).toBeNull();
    expect(extractNumericId(undefined)).toBeNull();
    expect(extractNumericId("")).toBeNull();
    expect(extractNumericId("no-numbers-here")).toBeNull();
  });
});

describe("admin URL builders", () => {
  it("buildShopifyAdminUrl returns the /admin root", () => {
    expect(buildShopifyAdminUrl(SHOP_DOMAIN)).toBe(`https://${SHOP_DOMAIN}/admin`);
  });

  it("buildShopifyProductAdminUrl uses numeric id from gid", () => {
    expect(buildShopifyProductAdminUrl(SHOP_DOMAIN, "gid://shopify/Product/42")).toBe(
      `https://${SHOP_DOMAIN}/admin/products/42`,
    );
  });

  it("buildShopifyProductAdminUrl falls back to admin root for bad gid", () => {
    expect(buildShopifyProductAdminUrl(SHOP_DOMAIN, "bad")).toBe(`https://${SHOP_DOMAIN}/admin`);
  });

  it("buildShopifyArticleAdminUrl builds /blogs/:blogId/articles/:articleId", () => {
    expect(
      buildShopifyArticleAdminUrl(SHOP_DOMAIN, "gid://shopify/Blog/10", "gid://shopify/Article/20"),
    ).toBe(`https://${SHOP_DOMAIN}/admin/blogs/10/articles/20`);
  });

  it("buildShopifyArticleAdminUrl falls back to /admin/articles when ids missing", () => {
    expect(buildShopifyArticleAdminUrl(SHOP_DOMAIN, "x", "y")).toBe(
      `https://${SHOP_DOMAIN}/admin/articles`,
    );
  });

  it("buildShopifyPageAdminUrl uses numeric id from gid", () => {
    expect(buildShopifyPageAdminUrl(SHOP_DOMAIN, "gid://shopify/Page/77")).toBe(
      `https://${SHOP_DOMAIN}/admin/pages/77`,
    );
  });

  it("buildShopifyPageAdminUrl falls back to /admin/pages when gid bad", () => {
    expect(buildShopifyPageAdminUrl(SHOP_DOMAIN, "bad")).toBe(`https://${SHOP_DOMAIN}/admin/pages`);
  });
});

describe("shopifyGraphqlRequest", () => {
  it("POSTs to the versioned admin GraphQL URL with access-token header", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { ok: true } }));

    await shopifyGraphqlRequest<{ ok: boolean }>({
      accessToken: "shpat_token",
      shopDomain: SHOP_DOMAIN,
      query: "query Foo { ok }",
      variables: { a: 1 },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(GRAPHQL_URL);
    expect((init as RequestInit).method).toBe("POST");
    expect((init as RequestInit).headers).toMatchObject({
      "X-Shopify-Access-Token": "shpat_token",
      "Content-Type": "application/json",
      Accept: "application/json",
    });
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      query: "query Foo { ok }",
      variables: { a: 1 },
    });
  });

  it("throws when HTTP status is not OK", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
      text: async () => "Invalid token",
    });

    await expect(
      shopifyGraphqlRequest({
        accessToken: "bad",
        shopDomain: SHOP_DOMAIN,
        query: "query {}",
      }),
    ).rejects.toThrow(/401.*Invalid token/);
  });

  it("throws when GraphQL errors[] is non-empty", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ errors: [{ message: "Field foo doesn't exist" }] }),
    );

    await expect(
      shopifyGraphqlRequest({
        accessToken: "tok",
        shopDomain: SHOP_DOMAIN,
        query: "query {}",
      }),
    ).rejects.toThrow(/Shopify GraphQL error/);
  });

  it("throws when data is missing", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));

    await expect(
      shopifyGraphqlRequest({
        accessToken: "tok",
        shopDomain: SHOP_DOMAIN,
        query: "query {}",
      }),
    ).rejects.toThrow(/missing data/);
  });
});

describe("getShopifyShop", () => {
  it("returns shop record from data.shop", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          shop: {
            id: "gid://shopify/Shop/1",
            name: "Test",
            myshopifyDomain: SHOP_DOMAIN,
            primaryDomain: { host: SHOP_DOMAIN, url: `https://${SHOP_DOMAIN}` },
          },
        },
      }),
    );

    const shop = await getShopifyShop("tok", SHOP_DOMAIN);
    expect(shop.name).toBe("Test");
    expect(shop.myshopifyDomain).toBe(SHOP_DOMAIN);
  });
});

describe("listShopifyProducts", () => {
  it("returns first page when hasNextPage is false", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          products: {
            edges: [
              {
                cursor: "c1",
                node: { id: "gid://shopify/Product/1", title: "A", handle: "a", status: "ACTIVE" },
              },
            ],
            pageInfo: { hasNextPage: false, endCursor: "c1" },
          },
        },
      }),
    );

    const products = await listShopifyProducts("tok", SHOP_DOMAIN);
    expect(products).toHaveLength(1);
    expect(products[0].handle).toBe("a");
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("paginates when hasNextPage is true and stops at limit", async () => {
    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            products: {
              edges: Array.from({ length: 50 }, (_, i) => ({
                cursor: `c${i}`,
                node: {
                  id: `gid://shopify/Product/${i}`,
                  title: `P${i}`,
                  handle: `p${i}`,
                  status: "ACTIVE",
                },
              })),
              pageInfo: { hasNextPage: true, endCursor: "c49" },
            },
          },
        }),
      )
      .mockResolvedValueOnce(
        jsonResponse({
          data: {
            products: {
              edges: Array.from({ length: 50 }, (_, i) => ({
                cursor: `d${i}`,
                node: {
                  id: `gid://shopify/Product/${50 + i}`,
                  title: `P${50 + i}`,
                  handle: `p${50 + i}`,
                  status: "ACTIVE",
                },
              })),
              pageInfo: { hasNextPage: false, endCursor: "d49" },
            },
          },
        }),
      );

    const products = await listShopifyProducts("tok", SHOP_DOMAIN, 100);
    expect(products).toHaveLength(100);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });
});

describe("listShopifyBlogs", () => {
  it("returns blog records from edges", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          blogs: {
            edges: [
              { node: { id: "gid://shopify/Blog/1", title: "News", handle: "news" } },
              { node: { id: "gid://shopify/Blog/2", title: "Education", handle: "education" } },
            ],
          },
        },
      }),
    );

    const blogs = await listShopifyBlogs("tok", SHOP_DOMAIN);
    expect(blogs).toHaveLength(2);
    expect(blogs[0].handle).toBe("news");
  });
});

describe("setShopifyMetafields", () => {
  it("sends MetafieldsSetInput[] and returns ids + userErrors", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          metafieldsSet: {
            metafields: [{ id: "gid://shopify/Metafield/9" }],
            userErrors: [],
          },
        },
      }),
    );

    const result = await setShopifyMetafields({
      accessToken: "tok",
      shopDomain: SHOP_DOMAIN,
      metafields: [
        {
          ownerId: "gid://shopify/Product/1",
          namespace: SHOPIFY_METAFIELD_NAMESPACE,
          key: SHOPIFY_METAFIELD_KEYS.body,
          type: "multi_line_text_field",
          value: "<p>hi</p>",
        },
      ],
    });

    expect(result.ids).toEqual(["gid://shopify/Metafield/9"]);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.metafields[0]).toEqual({
      ownerId: "gid://shopify/Product/1",
      namespace: SHOPIFY_METAFIELD_NAMESPACE,
      key: SHOPIFY_METAFIELD_KEYS.body,
      type: "multi_line_text_field",
      value: "<p>hi</p>",
    });
  });

  it("surfaces userErrors when Shopify rejects", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          metafieldsSet: {
            metafields: [],
            userErrors: [{ field: ["value"], message: "Too long", code: "INVALID" }],
          },
        },
      }),
    );

    const result = await setShopifyMetafields({
      accessToken: "tok",
      shopDomain: SHOP_DOMAIN,
      metafields: [
        {
          ownerId: "gid://shopify/Product/1",
          namespace: SHOPIFY_METAFIELD_NAMESPACE,
          key: SHOPIFY_METAFIELD_KEYS.body,
          type: "multi_line_text_field",
          value: "x",
        },
      ],
    });

    expect(result.ids).toEqual([]);
    expect(result.userErrors[0].message).toBe("Too long");
  });
});

describe("createShopifyDraftArticle", () => {
  it("sends isPublished:false and returns mapped article", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          articleCreate: {
            article: {
              id: "gid://shopify/Article/9",
              title: "T",
              handle: "t",
              blog: { id: "gid://shopify/Blog/1", handle: "news" },
              publishedAt: null,
            },
            userErrors: [],
          },
        },
      }),
    );

    const result = await createShopifyDraftArticle({
      accessToken: "tok",
      shopDomain: SHOP_DOMAIN,
      blogId: "gid://shopify/Blog/1",
      title: "T",
      bodyHtml: "<p>x</p>",
      summary: "s",
    });

    expect(result.article?.id).toBe("gid://shopify/Article/9");
    expect(result.article?.publishedAt).toBeNull();
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.article.isPublished).toBe(false);
    expect(body.variables.article.blogId).toBe("gid://shopify/Blog/1");
  });
});

describe("createShopifyDraftPage", () => {
  it("sends isPublished:false and returns mapped page", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        data: {
          pageCreate: {
            page: { id: "gid://shopify/Page/5", title: "T", handle: "t", isPublished: false },
            userErrors: [],
          },
        },
      }),
    );

    const result = await createShopifyDraftPage({
      accessToken: "tok",
      shopDomain: SHOP_DOMAIN,
      title: "T",
      bodyHtml: "<p>x</p>",
    });

    expect(result.page?.id).toBe("gid://shopify/Page/5");
    expect(result.page?.isPublished).toBe(false);
    const body = JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string);
    expect(body.variables.page.isPublished).toBe(false);
  });
});

describe("contentToHtml", () => {
  it("wraps paragraphs in <p> tags", () => {
    const content = {
      id: "c1",
      brand_id: "b",
      cycle_id: null,
      content_type: "faq_snippet",
      title: null,
      body: "First.\n\nSecond.",
      target_prompts: [],
      medical_sources: [],
      created_at: "",
    } as GeneratedContentRecord;
    expect(contentToHtml(content)).toBe("<p>First.</p>\n<p>Second.</p>");
  });
});
