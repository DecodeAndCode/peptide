# Testing the Shopify CMS Deployment

The Shopify CMS deployer (`lib/shopify/cms-deployer.ts`) supports a **dry-run mode** so the full deploy flow can be exercised without a real Shopify store, OAuth credentials, or API calls. The architecture mirrors the Webflow deployer — same dry-run pattern, same gating, same CLI surface.

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
- `lib/shopify/oauth.test.ts` — `verifyShopifyHmac` signature verification, including signature tampering and missing-hmac cases.

## Real Shopify sandbox (optional)

To exercise the live path:

1. Create a Shopify Partner account at https://partners.shopify.com and spin up a **development store** under that account.
2. In the Partner dashboard, create a public app (or custom app, if working in a single store). Configure:
   - **App URL:** `${NEXT_PUBLIC_APP_URL}/settings`
   - **Allowed redirection URLs:** `${NEXT_PUBLIC_APP_URL}/api/integrations/shopify/callback`
   - **Scopes:** `read_products,write_products,read_content,write_content,read_themes`
3. Copy the Client ID + Client Secret into `.env.local`:
   ```
   SHOPIFY_API_KEY=<client id>
   SHOPIFY_API_SECRET=<client secret>
   SHOPIFY_SCOPES=read_products,write_products,read_content,write_content,read_themes
   ```
4. Restart the dev server. Sign in to SuppGO, go to Settings → Connect Shopify, enter the dev store's `*.myshopify.com` domain.
5. Approve the OAuth scopes. SuppGO redirects back with `?shopify=connected`.
6. Run an analysis cycle, then click **Apply CMS updates** on the dashboard or report.
7. Draft articles appear under **Online Store → Blog Posts** (unpublished), draft pages under **Online Store → Pages** (unpublished), and product metafields under each matched product's **Metafields → suppgo** namespace.

## One-CMS-at-a-time enforcement

`enforceSingleCmsConnection(brandId, incoming)` runs inside `saveShopifyIntegration` and `saveWebflowIntegration`. Connecting Shopify automatically deletes any existing Webflow row for the brand (and vice versa). The UI surfaces this — only one CMS card shows "Active" at a time on the Settings page.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Shopify is not connected.` | Connect via Settings, or pass `dryRun: true` / set `SUPPGO_CMS_DRY_RUN=1`. |
| `shopify_invalid_shop` redirect | The `?shop=` param didn't match `^[a-z0-9][a-z0-9-]*\.myshopify\.com$`. Custom domains are not accepted at install time — use the `*.myshopify.com` domain. |
| `shopify_hmac_invalid` redirect | Callback HMAC didn't verify. Most often: `SHOPIFY_API_SECRET` in `.env.local` doesn't match the Partner app secret. |
| `shopify_shop_mismatch` redirect | The shop in the callback differs from the shop the user entered at authorize time. Restart the install. |
| `No Shopify blog is available.` | Article-type content needs at least one blog. Create one in **Online Store → Blog Posts → Manage blogs**. |
| `No Shopify product matched ...` | Product matching scored below `MIN_PRODUCT_MATCH_SCORE` (85). Either rename the content's title to match a product handle, or pre-create the product in Shopify. |
| `Shopify rejected metafield write: ...` | Look at the `userErrors[].message`. Common: metafield definitions haven't been created, or the value exceeds Shopify's 65,535-char limit for `multi_line_text_field`. |

## Known gaps

- No automatic token refresh. Shopify access tokens are long-lived but can be revoked from the merchant side; in that case the next deploy will fail and require reconnect.
- Product metafield drafts live in the `suppgo` namespace; promoting them to the public product description is a manual step in Shopify Admin (or a future SuppGO publish-promote button).
- The dry-run adapter generates UUIDs for article/page IDs, so dry-run preview links don't deep-link to a specific admin page — they fall back to `/admin/articles` and `/admin/pages`. Live mode uses real numeric IDs from Shopify and deep-links correctly.
