# Patt — Personal Portfolio

Multi-page personal portfolio built with plain HTML, CSS, and JavaScript and deployed on Vercel.

## Main pages

- `index.html` — homepage
- `about.html` — profile, skills, and stats
- `work.html` — portfolio albums + lightbox
- `films.html` — searchable/sortable film list
- `contact.html` — contact and social links
- `admin.html` — legacy browser-based portfolio admin

The private `/thoughts` area is isolated from the main portfolio and has its own API/runtime.

## Content

Main-site content remains centralized in `js/data.js` so the existing admin panel keeps working.

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

## JavaScript structure

Shared behavior is kept small and page-specific behavior only loads where it is needed.

```text
js/
├─ data.js          # main-site content
├─ core.js          # profile, socials, nav, dark theme, reveal observer
├─ home.js          # homepage page transition
├─ about.js         # skills + stats
├─ work.js          # albums, collection overlay, lightbox
├─ films.js         # film parsing, search, sorting
├─ typer.js         # homepage title animation
├─ menu.js          # homepage fullscreen menu
├─ glass.js         # optional glass effect
├─ reveal-text.js   # About text reveal
└─ admin.js         # legacy portfolio admin
```

## CSS

- `css/styles.css` — shared portfolio layout/components
- `css/typer.css` — homepage hero
- `css/menu.css` — homepage fullscreen menu
- `css/glass.css` — optional glass enhancement
- `css/reveal-text.css` — About text animation

## Local development

A static server is recommended:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000`.

## Deployment

Vercel deploys the repository as a static site with the serverless functions under `api/` used by the private Thoughts area.
