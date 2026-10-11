# Patt — Personal Portfolio

Multi-page personal portfolio built with plain HTML, CSS, and JavaScript and deployed on Vercel.

## Main pages

- `index.html` — homepage
- `about.html` — profile, skills, and stats
- `work.html` — portfolio albums + lightbox
- `films.html` — searchable/sortable film list
- `contact.html` — contact and social links
- `/read` — password-gated fiction/archive reader
- `/admin` — server-side portfolio admin for films and work images
- `/storyadm` — server-side archive admin

Both admin surfaces use the same server-side admin session. GitHub credentials never need to be pasted into or stored by the browser.

## Content

Main-site content is centralized in `js/data.js`.

```text
siteData
├─ profile
├─ stats
├─ skills
├─ projects
├─ films
└─ socials
```

Portfolio images live under `assets/img/`. Album metadata is stored in `siteData.projects`.

Loose images uploaded directly into `assets/img/` are indexed by `assets/img/manifest.json`. The GitHub Action in `.github/workflows/build-gallery.yml` rebuilds that manifest when image files change.

## Archive storage

Archive data is stored in this repository on the public `thoughts-data` branch:

```text
thoughts-data
├─ content/thoughts.json
└─ assets/thoughts/
```

The `/read` access code gates the deployed reader UI and API. **The existing `thoughts-data` branch remains public**: an access code does not make its contents confidential. Do not store secrets in public archive content.

For truly private stories, first copy `content/thoughts.json` and `assets/thoughts/` into a separate **private** repository owned by `raihanavis0-nav` on branch `thoughts-data`. Give the deployment GitHub token read/write Contents access to that repository, set `THOUGHTS_STORAGE_REPO` to its name in Vercel, and verify both Reader and Admin before removing access to the old public branch. Do not remove the public source during a live migration. Publishing the data earlier means historical copies may remain in forks or commit history.

Reader appearance metadata is public; only the specifically configured decorative login/hero image is exposed by `/api/thoughts/appearance-media`. Protected story media still requires the session cookie.

Large legacy audio chunks that predate this migration are temporarily read from `alfathxxxxyz/websiteguaa@thoughts-data` when they are not present in this repository. New archive uploads are written to `raihanavis0-nav/webgw@thoughts-data`.

## Environment variables

The Vercel project uses:

- `THOUGHTS_ACCESS_CODE` — reader access code (minimum 16 characters)
- `THOUGHTS_ADMIN_USERNAME` — archive admin username
- `THOUGHTS_ADMIN_PASSWORD` — archive admin password
- `THOUGHTS_GITHUB_TOKEN` — GitHub token with Contents read/write permission on `raihanavis0-nav/webgw`; used for archive admin writes
- `THOUGHTS_LEGACY_GITHUB_TOKEN` — temporary read-only token for legacy audio chunks in `alfathxxxxyz/websiteguaa`
- `THOUGHTS_STORAGE_REPO` — optional **separate private** repository name (owner stays `raihanavis0-nav`); only switch after copying all data and media
- `THOUGHTS_STORAGE_BRANCH` — optional content branch override, default `thoughts-data`
- `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` — strongly recommended for **global serverless login rate limiting**. If absent, the implementation retains best-effort per-instance memory limits only
- `THOUGHTS_SESSION_SECRET` — recommended independent admin session signing secret
- `THOUGHTS_READER_SESSION_SECRET` — optional independent reader session signing secret

For archive editing, `THOUGHTS_GITHUB_TOKEN` needs Contents read/write permission on `raihanavis0-nav/webgw`. Until legacy audio chunks are migrated, keep the old repo token in `THOUGHTS_LEGACY_GITHUB_TOKEN`. There are legacy chunks that still depend on the old repository. An idempotent migration utility is included:

```bash
THOUGHTS_GITHUB_TOKEN=... THOUGHTS_LEGACY_GITHUB_TOKEN=... node scripts/migrate-legacy-audio.js
```

It copies only missing chunks and verifies blob SHA before updating the `thoughts-data` branch. Migration needs authenticated GitHub access and has **not** been run automatically. After verifying the transfer, remove the legacy read token. For backward compatibility, the code falls back to `THOUGHTS_GITHUB_TOKEN` when the legacy variable is absent.

Check archive regressions locally with `node --test scripts/test-reader-regressions.js`. CI runs that command as well.

## JavaScript structure

Shared behavior is kept small and page-specific behavior only loads where needed. `js/admin.js` talks only to same-origin server APIs; it does not contain or persist a GitHub token.

```text
js/
├─ data.js
├─ core.js
├─ home.js
├─ about.js
├─ work.js
├─ films.js
├─ typer.js
├─ menu.js
├─ glass.js
├─ reveal-text.js
└─ thoughts-*.js
```

## Local development

A static server is recommended:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`. Serverless archive APIs require the Vercel runtime/environment variables.

## Deployment

Vercel deploys `main`. Deployments are explicitly disabled for the `thoughts-data` branch.
