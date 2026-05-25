import { randomUUID } from "crypto";
import {
  createWebflowDraftItem,
  getWebflowCollection,
  listWebflowCollections,
  listWebflowItems,
  listWebflowSites,
  updateWebflowDraftItem,
  type WebflowCollection,
  type WebflowItem,
} from "@/lib/webflow/client";
import type { WebflowSiteSummary } from "@/types";

export interface WebflowAdapter {
  readonly isDryRun: boolean;
  listSites(): Promise<WebflowSiteSummary[]>;
  listCollections(siteId: string): Promise<WebflowCollection[]>;
  getCollection(collectionId: string): Promise<WebflowCollection>;
  listItems(collectionId: string): Promise<WebflowItem[]>;
  createDraftItem(opts: {
    collectionId: string;
    fieldData: Record<string, unknown>;
  }): Promise<{ id: string; fieldData?: Record<string, unknown> }>;
  updateDraftItem(opts: {
    collectionId: string;
    itemId: string;
    fieldData: Record<string, unknown>;
  }): Promise<{ id: string; fieldData?: Record<string, unknown> }>;
}

export function createHttpAdapter(accessToken: string): WebflowAdapter {
  return {
    isDryRun: false,
    listSites: () => listWebflowSites(accessToken),
    listCollections: (siteId) => listWebflowCollections(accessToken, siteId),
    getCollection: (collectionId) => getWebflowCollection(accessToken, collectionId),
    listItems: (collectionId) => listWebflowItems(accessToken, collectionId),
    createDraftItem: ({ collectionId, fieldData }) =>
      createWebflowDraftItem({ accessToken, collectionId, fieldData }),
    updateDraftItem: ({ collectionId, itemId, fieldData }) =>
      updateWebflowDraftItem({ accessToken, collectionId, itemId, fieldData }),
  };
}

export interface DryRunFixture {
  site: WebflowSiteSummary;
  collections: WebflowCollection[];
  items: Record<string, WebflowItem[]>;
}

const DEFAULT_DRY_RUN_FIXTURE: DryRunFixture = {
  site: {
    id: "dryrun-site",
    displayName: "SuppGO dry-run site",
    shortName: "suppgo-dryrun",
    previewUrl: null,
  },
  collections: [
    {
      id: "dryrun-blog",
      displayName: "Blog Posts",
      singularName: "Blog Post",
      fields: [
        { id: "name", slug: "name", displayName: "Name", type: "PlainText", isRequired: true, isEditable: true },
        { id: "slug", slug: "slug", displayName: "Slug", type: "PlainText", isRequired: true, isEditable: true },
        { id: "body", slug: "body", displayName: "Body", type: "RichText", isRequired: false, isEditable: true },
        {
          id: "excerpt",
          slug: "excerpt",
          displayName: "Excerpt",
          type: "PlainText",
          isRequired: false,
          isEditable: true,
        },
      ],
    },
    {
      id: "dryrun-faq",
      displayName: "FAQ",
      singularName: "FAQ Entry",
      fields: [
        {
          id: "name",
          slug: "name",
          displayName: "Question",
          type: "PlainText",
          isRequired: true,
          isEditable: true,
        },
        { id: "slug", slug: "slug", displayName: "Slug", type: "PlainText", isRequired: true, isEditable: true },
        { id: "body", slug: "body", displayName: "Answer", type: "RichText", isRequired: false, isEditable: true },
      ],
    },
  ],
  items: {},
};

export function createDryRunAdapter(fixture: DryRunFixture = DEFAULT_DRY_RUN_FIXTURE): WebflowAdapter {
  const items = new Map<string, WebflowItem[]>(Object.entries(fixture.items));
  const collectionsById = new Map(fixture.collections.map((collection) => [collection.id, collection]));

  return {
    isDryRun: true,
    async listSites() {
      return [fixture.site];
    },
    async listCollections() {
      return fixture.collections;
    },
    async getCollection(collectionId) {
      const collection = collectionsById.get(collectionId);
      if (!collection) {
        throw new Error(`dry-run: unknown collection ${collectionId}`);
      }
      return collection;
    },
    async listItems(collectionId) {
      return items.get(collectionId) ?? [];
    },
    async createDraftItem({ collectionId, fieldData }) {
      const newItem: WebflowItem = {
        id: `dryrun-item-${randomUUID()}`,
        fieldData,
      };
      const bucket = items.get(collectionId) ?? [];
      bucket.push(newItem);
      items.set(collectionId, bucket);
      return newItem;
    },
    async updateDraftItem({ collectionId, itemId, fieldData }) {
      const bucket = items.get(collectionId) ?? [];
      const target = bucket.find((item) => item.id === itemId);
      if (target) {
        target.fieldData = { ...target.fieldData, ...fieldData };
        return target;
      }
      const synthetic: WebflowItem = { id: itemId, fieldData };
      bucket.push(synthetic);
      items.set(collectionId, bucket);
      return synthetic;
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
