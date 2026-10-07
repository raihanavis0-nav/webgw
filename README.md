# Patt — Personal Portfolio

Multi-page personal portfolio built with plain HTML, CSS, and JavaScript and deployed on Vercel.

## Main pages

- `index.html` — homepage
- `about.html` — profile, skills, and stats
- `work.html` — portfolio albums + lightbox
- `films.html` — searchable/sortable film list
- `contact.html` — contact and social links
- `/read` — password-gated fiction/archive reader
- `/storyadm` — server-side archive admin

The old browser-based `/admin` that stored a GitHub PAT in localStorage has been removed. Requests to `/admin` are redirected to `/storyadm`.

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
- `THOUGHTS_GITHUB_TOKEN` — GitHub token used only for archive writes and temporary legacy-audio fallback
- `THOUGHTS_SESSION_SECRET` — recommended independent admin session signing secret
- `THOUGHTS_READER_SESSION_SECRET` — optional independent reader session signing secret

For archive editing, `THOUGHTS_GITHUB_TOKEN` needs Contents read/write permission on `raihanavis0-nav/webgw`. Until legacy audio chunks are migrated, it also needs read access to `alfathxxxxyz/websiteguaa`.

## JavaScript structure

Shared behavior is kept small and page-specific behavior only loads where needed.

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
