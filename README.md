# SuppGO

SuppGO is a Next.js application for supplement and wellness brands to analyze AI search visibility, run report cycles, manage influencer discovery, and publish generated content through integrations.

## Tech Stack

- Next.js 14 with the App Router
- React 18 and TypeScript
- Tailwind CSS
- Supabase
- OpenAI, Anthropic, and Perplexity integrations
- GitHub integration for deployment workflows

## Getting Started

Install dependencies:

```bash
npm install
```

Run the development server:

```bash
npm run dev
```

Run validation before opening a pull request:

```bash
npm run lint
npm run typecheck
npm run build
```

## Contribution Guidelines

We keep contributions small, reviewable, and owned by the person who opens the pull request.

1. Create an issue before starting non-trivial work.
2. Branch from `master` using a clear branch name, such as `feature/report-export` or `fix/github-callback`.
3. Keep each pull request focused on one feature, bug fix, or cleanup.
4. Update documentation when behavior, setup, configuration, or contributor workflow changes.
5. Add or update tests when a change affects business logic, integrations, auth, data handling, or user-visible behavior.
6. Run `npm run lint`, `npm run typecheck`, and `npm run build` before requesting review.
7. Fill out the pull request template completely.

## Pull Request Ownership

Every pull request must have a directly responsible contributor.

- The PR author is automatically assigned when the PR opens.
- The assigned contributor owns the PR until it is merged or closed.
- The assigned contributor responds to review comments, keeps the branch current, and confirms all checks pass.
- Code owners or maintainers review the PR before merge.
- The assigned contributor should not self-merge unless they are also an approved maintainer and the repository rules allow it.
- A maintainer performs the final merge after checks pass, review is approved, and unresolved conversations are closed.

## Review Standards

Reviewers should focus on correctness, security, maintainability, performance, product behavior, and missing tests. Style-only feedback should be limited to cases where it improves consistency or readability.

Before approval, reviewers should confirm:

- The change matches the linked issue or stated PR goal.
- The implementation follows existing project patterns.
- User-facing behavior is clear and intentional.
- Secrets, tokens, and private data are not logged or committed.
- Supabase migrations are safe and reversible when applicable.
- New integration behavior handles network and provider failures gracefully.
- The validation commands were run or CI passed.

## Merge Policy

Use pull requests for all changes to `master`.

A pull request can be merged when:

- It has an assigned contributor.
- The PR template checklist is complete.
- Required checks are passing.
- At least one maintainer or code owner has approved it.
- All requested changes and review threads are resolved.
- The branch is up to date when the change touches shared app, database, auth, or integration code.

Prefer squash merges for feature and fix branches so `master` keeps a clean history. Use a merge commit only when preserving the branch history is important.

## Repository Configuration

This repository includes GitHub configuration under `.github/`:

- Pull request template
- Issue templates
- CODEOWNERS defaults
- PR governance workflow that assigns pull requests to their author
- Dependabot configuration for npm and GitHub Actions updates

See [CONTRIBUTING.md](CONTRIBUTING.md) for the full contributor workflow.
