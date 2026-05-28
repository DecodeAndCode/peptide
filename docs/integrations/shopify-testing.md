# Testing the Shopify CMS Deployment

The Shopify CMS deployer (`lib/shopify/cms-deployer.ts`) supports a **dry-run mode** so the full deploy flow can be exercised without a real Shopify store, API token, or API calls. The architecture mirrors the Webflow deployer — same dry-run pattern, same gating, same CLI surface.

SuppGO does **not** use Shopify OAuth. Each brand creates a per-store custom app in their Shopify admin and pastes the resulting Admin API access token (`shpat_…`) into SuppGO Settings. The connect route validates the token via a `shop { name }` GraphQL probe before saving it encrypted.

## Dry-run modes

Dry-run is gated by either:

1. The `dryRun: true` option passed to `deployCycleToShopify(...)` directly.
2. The environment variable `SUPPGO_CMS_DRY_RUN=1` (or `true`).
3. The HTTP request field `dry_run: true` on `POST /api/integrations/cms/deploy-cycle` (with `provider: "shopify"`).

When dry-run is active:

- `getShopifyIntegration` and `getDecryptedAccessToken` are **skipped** — no token is required.
- An in-memory adapter (`lib/shopify/adapter.ts` → `createDryRunAdapter`) returns a synthetic shop (`suppgo-dryrun.myshopify.com`) with 3 products (Magnesium Glycinate, Vitamin D3, Daily Greens) and 1 blog (News).
- All `getShop`/`listProducts`/`listBlogs`/`setMetafields`/`createDraftArticle`/`createDraftPage` calls run against in-memory state.
- The deployment run record warns: `DRY RUN — no real Shopify calls were made.`

In **production** (`NODE_ENV=production`), dry-run is rejected by the API route unless `SUPPGO_ALLOW_DRY_RUN_PROD=1` is set on the server.

## Content → Shopify routing

| `content_type` | Shopify target | How |
|---|---|---|
| `faq_snippet`, `product_interaction`, `blog_post` | Article (draft) | `articleCreate` with `isPublished: false` against the first blog. |
| `product_description` | Product (metafields) | `metafieldsSet` writes `suppgo.proposed_body_html`, `suppgo.proposed_seo_title`, `suppgo.proposed_seo_description` on the matched product. **Existing product copy is never overwritten** — drafts live in the `suppgo` namespace until you promote them. |
| `landing_page_section` | Page (draft) | `pageCreate` with `isPublished: false`. |
| `llms_txt` | Skipped | Host `llms.txt` from your storefront instead. |

Product matching uses handle equality, normalized-title equality, and substring fallback. Threshold: `MIN_PRODUCT_MATCH_SCORE = 85` (see `lib/shopify/cms-deployer.ts`).

## CLI smoke script

```bash
# Default = dry-run, no env vars required
npm run test:shopify:deploy

# Same, explicit
SUPPGO_CMS_DRY_RUN=1 npm run test:shopify:deploy

# Live mode against a real brand + cycle (requires Supabase service role + Shopify token)
npm run test:shopify:deploy -- --live --brand-id <uuid> --cycle-id <uuid>
```

The script (`scripts/test-shopify-deploy.ts`) prints the full `CmsDeploymentRunRecord` JSON. Exit code is non-zero only when the run status is `failed`. In dry-run, it monkey-patches `server-only`, `@/lib/supabase/server`, and `@/lib/integrations` so the deployer can execute outside a Next.js request context.

## Unit tests

```bash
npm test                                            # all tests
npx vitest run lib/shopify                          # shopify-only
npx vitest run lib/shopify/cms-deployer.dryrun.test.ts
```

Coverage:

- `lib/shopify/client.test.ts` — GraphQL request wrapper, URL builders, shop-domain validation, pagination.
- `lib/shopify/cms-deployer.test.ts` — `routeContent`, `findProductMatch`, `buildProductMetafields`.
- `lib/shopify/cms-deployer.dryrun.test.ts` — end-to-end deployer with dry-run adapter; asserts `fetch` is never called.

## Real Shopify sandbox (optional)

SuppGO uses Shopify's **Admin API access token** (custom-app token) flow — not OAuth. Each brand creates a custom app inside their own store and pastes the resulting `shpat_…` token into SuppGO. No Shopify Partner app, no public listing, no callback URL.

1. Create a Shopify Partner account at https://partners.shopify.com and spin up a **development store** (or use any existing Shopify store you control).
2. In **Shopify admin → Settings → Apps and sales channels → Develop apps**, click **Create an app**. Name it "SuppGO".
3. Open **Configuration → Admin API integration → Configure** and grant these scopes:
   - `read_products`, `write_products`
   - `read_content`, `write_content`
4. Click **Install app**, then copy the **Admin API access token** (starts with `shpat_`). It is shown once — save it.
5. Sign in to SuppGO, go to **Settings → Connect Shopify**, paste the `*.myshopify.com` domain + the `shpat_…` token, click **Connect Shopify**.
6. SuppGO validates the token by calling `shop { name }` on the GraphQL Admin API, then stores it encrypted.
7. Run an analysis cycle, then click **Apply CMS updates** on the dashboard or report.
8. Draft articles appear under **Online Store → Blog Posts** (unpublished), draft pages under **Online Store → Pages** (unpublished), and product metafields under each matched product's **Metafields → suppgo** namespace.

## One-CMS-at-a-time enforcement

`enforceSingleCmsConnection(brandId, incoming)` runs inside `saveShopifyIntegration` and `saveWebflowIntegration`. Connecting Shopify automatically deletes any existing Webflow row for the brand (and vice versa). The UI surfaces this — only one CMS card shows "Active" at a time on the Settings page.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Shopify is not connected.` | Connect via Settings, or pass `dryRun: true` / set `SUPPGO_CMS_DRY_RUN=1`. |
| "Enter a valid *.myshopify.com domain." | Domain didn't match `^[a-z0-9][a-z0-9-]*\.myshopify\.com$`. Use the `*.myshopify.com` domain, not your custom storefront domain. |
| "Admin API access token must start with shpat_..." | Token doesn't look like a custom-app token. Regenerate from **Shopify admin → Apps → Develop apps → SuppGO → API credentials → Install app**. |
| "Could not reach Shopify with that token" | Token is rejected by Shopify. Confirm the token belongs to the same store as the domain, and that the required scopes are granted. |
| `No Shopify blog is available.` | Article-type content needs at least one blog. Create one in **Online Store → Blog Posts → Manage blogs**. |
| `No Shopify product matched ...` | Product matching scored below `MIN_PRODUCT_MATCH_SCORE` (85). Either rename the content's title to match a product handle, or pre-create the product in Shopify. |
| `Shopify rejected metafield write: ...` | Look at the `userErrors[].message`. Common: metafield definitions haven't been created, or the value exceeds Shopify's 65,535-char limit for `multi_line_text_field`. |

## Known gaps

- No automatic token refresh. Shopify access tokens are long-lived but can be revoked from the merchant side; in that case the next deploy will fail and require reconnect.
- Product metafield drafts live in the `suppgo` namespace; promoting them to the public product description is a manual step in Shopify Admin (or a future SuppGO publish-promote button).
- The dry-run adapter generates UUIDs for article/page IDs, so dry-run preview links don't deep-link to a specific admin page — they fall back to `/admin/articles` and `/admin/pages`. Live mode uses real numeric IDs from Shopify and deep-links correctly.
