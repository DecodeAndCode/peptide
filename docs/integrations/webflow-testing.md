# Testing the Webflow CMS Deployment

The Webflow CMS deployer (`lib/webflow/cms-deployer.ts`) supports a **dry-run mode** so the full deploy flow can be exercised without a real Webflow account, OAuth credentials, or API calls.

## Dry-run modes

Dry-run is gated by either:

1. The `dryRun: true` option passed to `deployCycleToWebflow(...)` directly.
2. The environment variable `SUPPGO_CMS_DRY_RUN=1` (or `true`).
3. The HTTP request field `dry_run: true` on `POST /api/integrations/cms/deploy-cycle`.

When dry-run is active:

- `getWebflowIntegration` and `getDecryptedAccessToken` are **skipped** — no token is required.
- An in-memory adapter (`lib/webflow/adapter.ts` → `createDryRunAdapter`) returns a synthetic site (`dryrun-site`) with two collections (`Blog Posts`, `FAQ`).
- All `listSites`/`listCollections`/`getCollection`/`listItems`/`createDraftItem`/`updateDraftItem` calls run against in-memory state.
- The deployment run record warns: `DRY RUN — no real Webflow calls were made.`

In **production** (`NODE_ENV=production`), dry-run is rejected by the API route unless `SUPPGO_ALLOW_DRY_RUN_PROD=1` is set on the server. This guards against accidental simulated runs in prod.

## CLI smoke script

```bash
# Default = dry-run, no env vars required
npm run test:webflow:deploy

# Same, explicit
SUPPGO_CMS_DRY_RUN=1 npm run test:webflow:deploy

# Live mode against a real brand + cycle (requires Supabase service role + Webflow token)
npm run test:webflow:deploy -- --live --brand-id <uuid> --cycle-id <uuid>
```

The script (`scripts/test-webflow-deploy.ts`) prints the full `CmsDeploymentRunRecord` JSON. Exit code is non-zero only when the run status is `failed`.

In dry-run, the script monkey-patches `server-only`, `@/lib/supabase/server`, and `@/lib/integrations` so the deployer can execute outside a Next.js request context.

## Unit tests

```bash
npm test                                          # all tests
npx vitest run lib/webflow                        # webflow-only
npx vitest run lib/webflow/cms-deployer.dryrun.test.ts
```

Coverage includes:

- `lib/text.test.ts` — pure helpers (slugify, excerpt, html escaping).
- `lib/webflow/client.test.ts` — HTTP client with `fetch` stubbed (`listSites`, `listItems` pagination, draft create/update, 401 error).
- `lib/webflow/cms-deployer.test.ts` — pure scoring/mapping/field-building logic.
- `lib/webflow/cms-deployer.dryrun.test.ts` — end-to-end deployer with dry-run adapter, asserting `fetch` is never called.

## Real Webflow sandbox (optional)

To exercise the live path:

1. Create a Webflow workspace + site at https://webflow.com.
2. Add a Blog Posts CMS collection with at least `Name` (PlainText, required), `Slug` (PlainText, required), `Body` (RichText).
3. Register a Webflow OAuth app at https://webflow.com/developers and set the redirect URI to `${APP_BASE_URL}/api/integrations/webflow/callback`.
4. Add `WEBFLOW_OAUTH_CLIENT_ID` and `WEBFLOW_OAUTH_CLIENT_SECRET` to `.env.local`.
5. Sign in to SuppGO, go to Settings → Connect Webflow, pick the sandbox site.
6. Run an analysis cycle, then click **Apply CMS updates** on the dashboard or report.
7. Draft items should appear in the sandbox Webflow CMS within seconds.

## Troubleshooting

| Symptom | Cause / fix |
|---|---|
| `Webflow is not connected.` | Either connect via Settings, or pass `dryRun: true` / set `SUPPGO_CMS_DRY_RUN=1`. |
| `No Webflow sites were available...` | Token lacks `sites:read` scope, or the workspace has no sites. Reconnect. |
| `401 Unauthorized` from Webflow | Token expired. Token refresh is **not yet implemented** — disconnect + reconnect to recover. |
| Dry-run rejected in production | Set `SUPPGO_ALLOW_DRY_RUN_PROD=1` on the server, or run from a preview/dev environment. |
| Collection match rate is zero | The deployer requires `Name`, `Slug`, and at least one body-like field per collection (RichText preferred). Collections with required non-text fields without defaults are skipped. |

## Known gaps

- No automatic token refresh — long-running sessions will see 401 once the Webflow token expires. Tracked as a follow-up.
- No rollback on partial failure — the deployer reports `partial_success` but does not delete drafts created before the failure point.
- Draft preview URLs are not deep-linked to the specific CMS item; we link to the site dashboard.
