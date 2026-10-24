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


## Story Timeline (Reader + Admin)

The Reader Timeline is a compact, responsive chronological map: **year anchors** on the left, **seasonal horizontal snake lanes** on desktop and a vertical episode list on mobile. Each episode links to its chapter, and readers can filter by year, reverse the order and collapse a year. Series/Sub-series context filters still apply.

Dates are **in-story dates**, separate from the publishing date:

- Story Admin → **Timeline**: select a Series/Sub-series, filter dated or undated episodes, edit Year/Month/Day (or choose Month / Season / Year precision), then **Save timeline dates**. Multiple episodes can be saved in one operation with revision/conflict protection.
- Story Editor → Actions → **Include in Timeline**: set the episode's in-story date and preview its reader label.
- Stored fields: `timelineEnabled`, `timelineYear`, `timelineMonth`, `timelineDay`, `timelineSeason`, `timelinePrecision`. Years are integers 1–9999 and exact dates must be real calendar days. All chronology is sorted automatically; publication `date` and episode `order` are unchanged.
- Existing legacy Timeline metadata (`timelineLabel`, `timelineGroup`, `timelineOrder`) is **not erased**; enabled entries with legacy labels remain visible in "Other dates" until an editor assigns a structured date.
- Never infer fictional chronology from publish dates. The Reader shows an appropriate empty state until dates are configured.

Run regression tests: `node --test scripts/test-timeline.js` (also in CI). No additional Serverless Functions are added, preserving the Vercel Hobby API budget.


## Community book ratings

The Reader Series shelf lets authenticated readers rate each Series/book from 1 to 5 stars. It shows the shared average and number of votes. A browser can change its own rating without adding another count; a random anonymous per-book ID is stored in localStorage. Clearing browser storage or using a new browser allows another identity, so this is basic duplicate protection, **not** one-person-one-vote verification.

Ratings use the **existing optional Upstash Redis** environment variables (\`UPSTASH_REDIS_REST_URL\`, \`UPSTASH_REDIS_REST_TOKEN\`). No SQL schema, new serverless function, or browser-exposed secret is needed. Shared counts require this service: if it is not configured or offline, rating controls are disabled and no fabricated averages appear.

The authenticated \`GET /api/thoughts/content?ratings=1\` reads summary scores, while same-origin \`POST /api/thoughts/content\` submits a rating. The server only accepts existing Series IDs and uses an atomic Redis Lua script to update the vote and aggregate, with a coarse hourly write limit. Ratings are kept in Redis, separate from the GitHub-hosted fiction content.


## Reader / Writer activity (2026-10)

Authenticated archive saves record server-side createdAt, updatedAt, and publishedAt when applicable. Old records are NOT assigned synthetic historical dates. An explicit Story Admin announcement sets lastPublicUpdateAt, publicUpdateNote and publicUpdateType. The separate homepage checkbox controls publicFeedEnabled; a routine Save does NOT publish an update publicly.

- Public homepage fetches the latest three opt-in, published, nonempty announcement summaries from /api/thoughts/appearance-media?activity=1 (existing endpoint). It exposes only title, slug, Series/Book name, announcement type, note and time. No manuscript text or draft content.
- Protected Reader adds What's New, unread badges, local Follow Series. Existing EditorialReading code already provides Continue Reading and reading progress, so it is reused unchanged.
- Metadata is server-authoritative after a successful save. Unpublish or uncheck public-feed checkbox to hide a previous announcement.
- Only explicitly announced entries enter the public feed. Past placeholder chapters receive no fabricated update date. Browser preferences do not sync between devices.

### Cleanup audit

The following JS modules are not loaded by current HTML entrypoints: js/thoughts-content-sync.js, js/thoughts-sortable.js, js/thoughts-empty-structure.js, js/thoughts-ending-song-admin.js, js/thoughts-rich-reader.js, js/thoughts-collapse.js (and matching CSS peers). Some are still conditionally referenced; they have NOT been deleted. js/script-workspace.js is a pre-Plotwell writing engine not loaded by current Admin, kept as a rollback safety net. Do not remove modules without checking their dynamic entrypoints and regression tests.
