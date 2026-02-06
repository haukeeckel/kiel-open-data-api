# Git Convention

This document defines how we work with Git in this repository:

- commit messages (conventional commits)
- branch naming
- feature-branch workflow (PR flow)
- merge strategy
- optional release / tagging rules

---

## 1) Commit Messages (Conventional Commits)

### Format

`<type>(<scope>): <subject>`

Examples:

- `feat(server): add health endpoint`
- `fix(db): handle empty result set`
- `chore(repo): add eslint and prettier`

### Rules

- English only
- Imperative mood (e.g. "add", "fix", "update")
- Max 72 characters in the header
- No trailing period
- One purpose per commit (keep commits small and focused)

### Allowed types

| Type       | Meaning                                                 |
| ---------- | ------------------------------------------------------- |
| `feat`     | New feature                                             |
| `fix`      | Bug fix                                                 |
| `docs`     | Documentation only                                      |
| `chore`    | Tooling, housekeeping, dependency updates               |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `test`     | Add/adjust tests                                        |
| `perf`     | Performance improvement                                 |
| `build`    | Build system changes                                    |
| `ci`       | CI configuration changes                                |
| `style`    | Formatting only (no logic changes)                      |

### Scopes

Scopes should match the area of change.
Start small and grow over time.

Recommended initial scopes:

| Scope    | Notes                   |
| -------- | ----------------------- |
| `repo`   | meta / tooling / config |
| `docs`   | documentation           |
| `server` | backend server          |
| `db`     | database / persistence  |
| `etl`    | import / transform jobs |
| `api`    | HTTP API surface        |

### Optional: Body & footer

Use the commit body for motivation/constraints.
Use footers for issue references or breaking changes:

- `Refs: #123`
- `BREAKING CHANGE: ...`

---

## 2) Branch Naming

### Format

`<type>/<short-kebab-description>`

Examples:

- `feat/api-timeseries`
- `fix/db-null-years`
- `chore/dx-commitlint`
- `docs/git-convention`

Allowed branch types:

| Type       | Used for                          |
| ---------- | --------------------------------- |
| `feat`     | new feature work                  |
| `fix`      | bug fixes                         |
| `chore`    | tooling / maintenance             |
| `docs`     | documentation changes             |
| `refactor` | refactors without behavior change |
| `test`     | test work                         |
| `perf`     | performance work                  |

Rules:

- short, descriptive, kebab-case
- no usernames, no dates unless necessary

---

## 3) Feature-Branch Workflow (PR Flow)

### The baseline

- `main` is always in a deployable state.
- Work happens on feature branches.
- Every change is merged via PR (even when working solo).

### Steps

1. Create a branch from `main`
2. Make small commits
3. Keep branch up to date (prefer rebase)
4. Open PR early (draft if needed)
5. PR must pass checks (lint, typecheck, tests)
6. Merge into `main` using the chosen merge strategy
7. Delete branch after merge

### Keeping branches up-to-date

Preferred:

- `git fetch origin`
- `git rebase origin/main`

Avoid long-lived branches.

---

## 4) Merge Strategy

Recommended default: **Squash merge**

- Keeps `main` history clean
- PR title becomes the squash commit message
- Ensure PR title follows commit convention:
  `feat(server): add timeseries endpoint`

Alternative (only when useful): **Merge commit**

- Use when preserving a multi-commit narrative is important.

Avoid:

- Merge commits from syncing `main` into your branch repeatedly.

---

## 5) Pull Request Checklist

Before merging:

- [ ] Lint passes (`pnpm lint`)
- [ ] Typecheck passes (`pnpm typecheck`)
- [ ] Tests pass (`pnpm test`) — if tests exist
- [ ] Docs updated (if behavior/config changed)
- [ ] No secrets committed (`.env`, API keys)
- [ ] No large binaries / raw datasets committed (use `data/` ignored)
- [ ] API changes documented (Swagger / README / examples)

Optional for UI:

- [ ] Screenshot/GIF attached

---

## 6) Hotfix Flow

If a critical bug is found on `main`:

1. Create `fix/<description>` branch from `main`
2. Minimal change, add regression test if possible
3. PR → squash merge
4. Tag a patch release if we use versioning

---

## 7) Releases & Tagging (Optional)

If we start versioning:

- Use SemVer: `vMAJOR.MINOR.PATCH`
- Tag from `main` only
- Release notes come from conventional commits

Recommended tools (choose later):

- Changesets OR semantic-release

---

## 8) Repo Hygiene

Never commit:

- `.env` (use `.env.example`)
- raw datasets / generated DB files (store under `data/`, keep ignored)
- build artifacts (`dist/`)

Prefer:

- small fixtures under `test/fixtures/` (tiny, curated)
- deterministic scripts for fetching/importing data
