# Contributing to SuppGO

Thank you for helping improve SuppGO. This guide explains how we plan work, assign ownership, review pull requests, and merge safely.

## Contribution Flow

1. Check existing issues and pull requests before starting.
2. Open an issue for bugs, feature requests, architecture changes, database changes, and integration changes.
3. Wait for a maintainer to confirm scope when the work is large or risky.
4. Create a branch from `master`.
5. Make a focused change.
6. Validate locally.
7. Open a pull request and complete the checklist.
8. Stay assigned to the PR until it is merged or closed.

## Branch Names

Use short, descriptive branch names:

- `feature/add-report-filters`
- `fix/github-oauth-state`
- `docs/contribution-guide`
- `chore/update-dependencies`

Avoid vague names like `changes`, `update`, or `fix-stuff`.

## Commit Guidelines

Use clear, imperative commit messages:

- `Add report download guardrails`
- `Fix GitHub callback error handling`
- `Document contribution workflow`

Keep commits meaningful. If a branch has many small work-in-progress commits, squash them before merge or let GitHub squash merge the PR.

## Local Validation

Run these commands before requesting review:

```bash
npm run lint
npm run typecheck
npm run build
```

If a command cannot run locally, explain why in the pull request and include any alternate validation you performed.

## Pull Request Assignment

Every pull request needs one assigned contributor.

- The GitHub workflow assigns the PR author automatically.
- The assigned contributor is responsible for the PR checklist, review responses, follow-up commits, and final readiness.
- If ownership changes, reassign the PR immediately and leave a comment explaining the handoff.
- If multiple people contribute, keep one primary assignee and mention co-authors in the PR description or commits.
- Maintainers may add reviewers, request changes, or reassign stale pull requests.

## Review Expectations

Reviewers should be constructive, specific, and direct. The goal is to improve the change, not to expand its scope unnecessarily.

Reviewers should check:

- Correctness and edge cases
- Security and privacy
- Error handling for external services
- Database migration safety
- Type safety
- Accessibility and responsive behavior for UI changes
- Consistency with existing project patterns
- Whether tests or documentation need updates

The assigned contributor should respond to each review thread. Use comments for clarification and commits for fixes.

## Merge Rules

A pull request is ready to merge when:

- The PR has an assignee.
- The PR template is complete.
- CI or local validation is passing.
- Required reviews are approved.
- All review conversations are resolved.
- The branch is current enough that merge risk is low.
- Any needed environment, migration, or deployment notes are documented.

Maintainers perform the merge. Contributors should not merge their own PR unless they are authorized maintainers and the PR meets the same review standard.

## Security and Secrets

Never commit secrets, API keys, tokens, database credentials, private customer data, or `.env` files.

When changing auth, billing, integrations, GitHub app flows, Supabase policies, rate limiting, or LLM provider calls:

- Document the risk in the PR.
- Include failure-mode handling.
- Avoid logging sensitive request or response data.
- Confirm server-only code does not leak into client bundles.

## Database and Supabase Changes

For schema changes:

- Add a migration under `supabase/migrations`.
- Keep migrations forward-safe.
- Document any required backfill or operational step in the PR.
- Verify generated types or runtime assumptions still match the schema.

## Documentation

Update documentation when you change:

- Setup steps
- Environment variables
- Contributor workflow
- Deployment behavior
- API contracts
- Database schema expectations
- User-facing behavior that needs explanation

## Stale Pull Requests

Maintainers may mark a PR as stale if it has no activity for more than 7 days after review feedback. After 14 days without response, maintainers may close it with a note. Closed work can be reopened when the contributor is ready to continue.
