import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  buildWebflowDashboardUrl,
  contentToHtml,
  createWebflowDraftItem,
  getWebflowCollection,
  listWebflowCollections,
  listWebflowItems,
  listWebflowSites,
  updateWebflowDraftItem,
} from "@/lib/webflow/client";
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

describe("listWebflowSites", () => {
  it("hits /v2/sites with bearer auth and maps site shapes", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({
        sites: [
          { id: "s1", displayName: "Alpha", shortName: "alpha", previewUrl: "https://a.example" },
          { id: "s2", displayName: null, shortName: "beta", previewUrl: null },
          { id: "s3", displayName: null, shortName: null, previewUrl: null },
        ],
      }),
    );

    const sites = await listWebflowSites("token-abc");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.webflow.com/v2/sites");
    expect((init as RequestInit).headers).toMatchObject({
      Authorization: "Bearer token-abc",
      "Content-Type": "application/json",
    });
    expect(sites).toEqual([
      { id: "s1", displayName: "Alpha", shortName: "alpha", previewUrl: "https://a.example" },
      { id: "s2", displayName: "beta", shortName: "beta", previewUrl: null },
      { id: "s3", displayName: "Untitled Webflow site", shortName: null, previewUrl: null },
    ]);
  });

  it("throws with status + body on non-OK responses", async () => {
    fetchMock.mockResolvedValueOnce({
      ok: false,
      status: 401,
      statusText: "Unauthorized",
      json: async () => ({}),
      text: async () => "Invalid token",
    });

    await expect(listWebflowSites("bad")).rejects.toThrow(/401.*Invalid token/);
  });
});

describe("listWebflowCollections", () => {
  it("returns collections array or empty fallback", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ collections: [{ id: "c1" }] }));
    const result = await listWebflowCollections("tok", "site-1");
    expect(result).toHaveLength(1);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.webflow.com/v2/sites/site-1/collections");
  });

  it("returns empty array when collections omitted", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({}));
    expect(await listWebflowCollections("tok", "site-1")).toEqual([]);
  });
});

describe("getWebflowCollection", () => {
  it("fetches /v2/collections/:id", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "c1", displayName: "Blog", singularName: "Post" }));
    const result = await getWebflowCollection("tok", "c1");
    expect(result.displayName).toBe("Blog");
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.webflow.com/v2/collections/c1");
  });
});

describe("listWebflowItems", () => {
  it("returns up to default limit (100) in a single call", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, fieldData: {} }));
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: firstBatch, pagination: { total: 150, limit: 100, offset: 0 } }),
    );

    const items = await listWebflowItems("tok", "coll-1");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(items).toHaveLength(100);
    expect(fetchMock.mock.calls[0][0]).toBe(
      "https://api.webflow.com/v2/collections/coll-1/items?limit=100&offset=0",
    );
  });

  it("paginates when caller requests more than one page", async () => {
    const firstBatch = Array.from({ length: 100 }, (_, i) => ({ id: `i${i}`, fieldData: {} }));
    const secondBatch = Array.from({ length: 50 }, (_, i) => ({ id: `j${i}`, fieldData: {} }));

    fetchMock
      .mockResolvedValueOnce(
        jsonResponse({ items: firstBatch, pagination: { total: 150, limit: 100, offset: 0 } }),
      )
      .mockResolvedValueOnce(
        jsonResponse({ items: secondBatch, pagination: { total: 150, limit: 100, offset: 100 } }),
      );

    const items = await listWebflowItems("tok", "coll-1", 200);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(items).toHaveLength(150);
  });

  it("stops when batch returns empty", async () => {
    fetchMock.mockResolvedValueOnce(
      jsonResponse({ items: [], pagination: { total: 0, limit: 100, offset: 0 } }),
    );
    expect(await listWebflowItems("tok", "empty")).toEqual([]);
  });
});

describe("createWebflowDraftItem", () => {
  it("POSTs to /items/bulk with isDraft true and isArchived false", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "new-item-1" }));

    const result = await createWebflowDraftItem({
      accessToken: "tok",
      collectionId: "coll-1",
      fieldData: { name: "Test", slug: "test" },
    });

    expect(result.id).toBe("new-item-1");
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.webflow.com/v2/collections/coll-1/items/bulk");
    expect((init as RequestInit).method).toBe("POST");
    const body = JSON.parse((init as RequestInit).body as string);
    expect(body).toEqual({
      fieldData: { name: "Test", slug: "test" },
      isArchived: false,
      isDraft: true,
    });
  });
});

describe("updateWebflowDraftItem", () => {
  it("PATCHes /items/:itemId with isDraft true", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ id: "item-x" }));

    await updateWebflowDraftItem({
      accessToken: "tok",
      collectionId: "coll-1",
      itemId: "item-x",
      fieldData: { name: "Updated" },
    });

    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("https://api.webflow.com/v2/collections/coll-1/items/item-x");
    expect((init as RequestInit).method).toBe("PATCH");
    expect(JSON.parse((init as RequestInit).body as string)).toEqual({
      fieldData: { name: "Updated" },
      isDraft: true,
    });
  });
});

describe("buildWebflowDashboardUrl", () => {
  it("returns Designer CMS deep link for a known site shortName", () => {
    expect(buildWebflowDashboardUrl("alpha")).toBe("https://alpha.design.webflow.com/?cms");
  });

  it("falls back to workspace dashboard when shortName is null", () => {
    expect(buildWebflowDashboardUrl(null)).toBe("https://webflow.com/dashboard");
  });
});

describe("contentToHtml", () => {
  it("delegates to paragraphsToHtml on content.body", () => {
    const content = {
      id: "c1",
      brand_id: "b",
      cycle_id: null,
      content_type: "faq_snippet",
      title: null,
      body: "Hello world.\n\nSecond.",
      target_prompts: [],
      medical_sources: [],
      created_at: "",
    } as GeneratedContentRecord;
    expect(contentToHtml(content)).toBe("<p>Hello world.</p>\n<p>Second.</p>");
  });
});
