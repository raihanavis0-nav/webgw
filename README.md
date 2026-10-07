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

The `/read` access code still gates the deployed reader UI and API, but the underlying `thoughts-data` branch is intentionally public. Do not store secrets in archive content.

Large legacy audio chunks that predate this migration are temporarily read from `alfathxxxxyz/websiteguaa@thoughts-data` when they are not present in this repository. New archive uploads are written to `raihanavis0-nav/webgw@thoughts-data`.

## Environment variables

The Vercel project uses:

- `THOUGHTS_ACCESS_CODE` — reader access code (minimum 16 characters)
- `THOUGHTS_ADMIN_USERNAME` — archive admin username
- `THOUGHTS_ADMIN_PASSWORD` — archive admin password
- `THOUGHTS_GITHUB_TOKEN` — GitHub token with Contents read/write permission on `raihanavis0-nav/webgw`; used for archive admin writes
- `THOUGHTS_LEGACY_GITHUB_TOKEN` — temporary read-only token for legacy audio chunks in `alfathxxxxyz/websiteguaa`
- `THOUGHTS_SESSION_SECRET` — recommended independent admin session signing secret
- `THOUGHTS_READER_SESSION_SECRET` — optional independent reader session signing secret

For archive editing, `THOUGHTS_GITHUB_TOKEN` needs Contents read/write permission on `raihanavis0-nav/webgw`. Until legacy audio chunks are migrated, keep the old repo token in `THOUGHTS_LEGACY_GITHUB_TOKEN`. For backward compatibility, the code falls back to `THOUGHTS_GITHUB_TOKEN` when the legacy variable is absent.

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
