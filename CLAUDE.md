# CLAUDE.md — Between Readers

## Project Overview

**Between Readers** is a literary book-crossing web application. Books are released into the wild with stickers containing an ISBN. Finders can scan or type the ISBN to look up the book, read its journey history, and add their own entry (location, date, message, photo). The tagline: *"Every book has a story. This is where it continues."*

This is a **vanilla JavaScript SPA** — no build step, no framework, no package manager.

---

## Repository Structure

```
between/
├── index.html                      # Single HTML page: structure, modal markup, section layout
├── app.js                          # Core app logic: Supabase client, data fetching, modal/form handling
├── scanner.js                      # Barcode scanning: ZXing WASM integration, camera lifecycle
├── style.css                       # All styling: design tokens, layout, animations, responsive
├── config.js                       # NOT in repo — must exist locally with Supabase credentials
├── supabase/
│   └── schema.sql                  # Database schema + RLS policies (run once in Supabase SQL Editor)
└── .github/
    └── workflows/
        └── deploy.yml              # GitHub Actions: injects secrets, deploys to GitHub Pages
```

### File Responsibilities

| File | Owns |
|------|------|
| `index.html` | Static markup, section structure, modal templates, script/style loading order |
| `app.js` | Supabase init, data layer, ISBN lookup, catalog rendering, form submission, modal open/close |
| `scanner.js` | Camera permission, ZXing lazy-load, scan loop, barcode detection, ISBN validation |
| `style.css` | All visual design — color tokens, typography, layout, animations |
| `config.js` | `SUPABASE_URL` and `SUPABASE_ANON_KEY` constants (gitignored) |

---

## Required Local Setup

`config.js` must exist at the project root (it is gitignored). Template:

```js
const SUPABASE_URL = 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY = 'your-anon-key';
```

No `npm install`, no build step. Open `index.html` directly in a browser or serve it with any static file server (e.g. `python3 -m http.server`).

---

## External Dependencies (CDN only)

| Library | Purpose | Loaded |
|---------|---------|--------|
| `@supabase/supabase-js@2` | Database client (books & entries) | Eagerly in `index.html` |
| `zxing-wasm@2.2.4` | ISBN/barcode scanning via WASM | Lazily in `scanner.js` on first camera open |
| Google Fonts | Cormorant Garamond, EB Garamond, Spectral | CSS `@import` |

---

## Database Schema (Supabase)

Two tables assumed by the application:

**`books`**
- `isbn` (text, primary key)
- `title` (text)
- `author` (text)
- `cover_url` (text, optional)
- Aggregated entry count returned via joined query

**`entries`**
- `id` (uuid or serial)
- `isbn` (text, FK → books)
- `found_location` (text)
- `found_date` (date)
- `message` (text)
- `photo_url` (text, optional)
- `created_at` (timestamp)

---

## Code Conventions

### JavaScript

- **Style:** Vanilla ES2020+ — async/await, template literals, optional chaining
- **Naming:** `camelCase` for functions and variables (`loadAndRenderCatalog`, `currentBook`)
- **Global state:** Two module-level globals: `books` (catalog array) and `currentBook` (currently open book object)
- **XSS prevention:** Always use `escapeHtml()` before inserting user data into innerHTML
- **Section markers:** Use `// ── Section Name ──` comment style to delineate logical blocks
- **Event handling:** A mix of inline `onclick` attributes in HTML and `addEventListener` in JS — keep them consistent with existing patterns (don't convert one style wholesale)
- **No modules:** Scripts load as plain `<script>` tags; functions in `app.js` are global and called from both HTML and `scanner.js`

### CSS

- **Design tokens:** All colors, fonts, spacing defined as CSS custom properties on `:root`
- **Color palette:** Cream background, ink text, rust/gold accents — preserve the literary aesthetic
- **Typography:** Serif fonts only (Cormorant Garamond primary, EB Garamond, Spectral fallback)
- **Naming:** BEM-adjacent kebab-case classes (`.book-card`, `.modal-overlay`, `.add-entry-section`)
- **Layout:** CSS Grid for book catalog grid, Flexbox for internal component layouts
- **Animations:** Named `@keyframes`: `fadeUp` (entrance), `pulse` (status indicator), `scanLine` (camera overlay)
- **Responsive:** Mobile breakpoint at `max-width: 600px`; prefer adjusting grid/flex over hiding content

### HTML

- Semantic HTML5 elements (`header`, `section`, `footer`, `button`)
- Comments mark major sections clearly
- Inline `onclick` handlers are acceptable and used throughout — do not refactor to addEventListener unless adding new interactivity

---

## Key Functions Reference

### app.js

| Function | Purpose |
|----------|---------|
| `escapeHtml(str)` | Sanitizes strings before innerHTML insertion |
| `normalizeISBN(isbn)` | Strips dashes/spaces from ISBN strings |
| `formatDate(dateStr)` | Formats ISO date to human-readable string |
| `loadAndRenderCatalog()` | Fetches all books with entry counts, renders grid |
| `lookupISBN(isbn)` | Queries Supabase for ISBN, opens journey modal |
| `openBookDirect(isbn)` | Opens a book from catalog card click |
| `openModal(book, entries)` | Renders and shows the journey modal |
| `closeModal()` | Hides modal, resets state |
| `resetEntryForm()` | Rebuilds the add-entry form HTML inside modal |
| `submitEntry()` | Validates and inserts new entry to Supabase |

### scanner.js

| Function | Purpose |
|----------|---------|
| `initZXing()` | Lazy-loads ZXing WASM, returns reader instance |
| `openCamera()` | Requests camera, opens overlay, starts scan loop |
| `startScanLoop(reader, video)` | Polls video frames every 300ms for barcodes |
| `onBarcodeDetected(text)` | Validates ISBN-13 (978/979 prefix), calls lookupISBN |
| `closeCamera()` | Stops media tracks, clears intervals, hides overlay |

---

## Development Workflow

### Running locally

```bash
# Any static server works
python3 -m http.server 8080
# Then open http://localhost:8080
```

Camera scanning requires HTTPS or `localhost` (browser security requirement).

### No build, no tests, no linter

There is no build step, test suite, or linter configured. Changes go directly to the served files.

### Git workflow

- Main development happens on feature branches prefixed `claude/`
- Commit messages are descriptive and lowercase (e.g. `split into separate files`)
- `config.js` is gitignored and must never be committed

---

## Deployment (GitHub Pages + Supabase)

### One-time Supabase setup

1. Create a project at [supabase.com](https://supabase.com) (free tier is sufficient)
2. Open the **SQL Editor** in the Supabase dashboard
3. Paste and run the contents of `supabase/schema.sql` — this creates both tables and RLS policies
4. Find your credentials under **Project Settings → API**:
   - **Project URL** → `SUPABASE_URL`
   - **anon / public key** → `SUPABASE_ANON_KEY`

### One-time GitHub setup

1. In your GitHub repo go to **Settings → Secrets and variables → Actions**
2. Add two repository secrets:
   - `SUPABASE_URL` — your Supabase project URL
   - `SUPABASE_ANON_KEY` — your Supabase anon key
3. Go to **Settings → Pages**
   - Set **Source** to `GitHub Actions`

### Deploying

Push to `main` — the workflow in `.github/workflows/deploy.yml` automatically:
1. Writes `config.js` from the GitHub Secrets
2. Uploads the site as a Pages artifact
3. Deploys to `https://<your-username>.github.io/<repo-name>/`

### Adding books to the catalog

Books must be inserted directly — visitors can only add journey entries, not new books. Use the Supabase dashboard **Table Editor** or run:

```sql
insert into books (isbn, title, author, cover_url)
values ('9780743273565', 'The Great Gatsby', 'F. Scott Fitzgerald', 'https://...');
```

### RLS policy summary

| Table | SELECT | INSERT | UPDATE / DELETE |
|-------|--------|--------|-----------------|
| `books` | Public | Admin only (dashboard / service key) | Admin only |
| `entries` | Public | Public (any visitor) | Nobody via anon key |

---

## Design Principles

1. **Literary aesthetic first** — the visual design is intentional and considered. Preserve the serif typography, muted color palette, and editorial feel. Don't introduce sans-serif fonts, bright colors, or generic UI patterns.
2. **No dependencies beyond what exists** — do not add npm packages, bundlers, or frameworks. If a feature can be built with vanilla JS and the existing Supabase/ZXing CDN libs, do that.
3. **XSS safety** — all user-generated content must pass through `escapeHtml()` before rendering as HTML.
4. **Progressive enhancement** — the page should display the catalog without camera support; scanning is an enhancement.
5. **Mobile-friendly** — the 600px breakpoint governs all responsive adjustments.

---

## Common Tasks

### Add a new field to the entry form

1. Update `resetEntryForm()` in `app.js` — add the input to the returned HTML string
2. Update `submitEntry()` in `app.js` — read and include the new field in the Supabase insert
3. Update `openModal()` in `app.js` — render the field in journey entries display
4. Add corresponding styles in `style.css` if needed

### Change the visual design

Edit CSS custom properties in the `:root` block near the top of `style.css`. Key tokens:
- `--color-cream` / `--color-ink` / `--color-rust` / `--color-gold` — primary palette
- `--font-primary` / `--font-secondary` — typeface stacks
- `--shadow-*` — elevation/depth

### Add a new page section

1. Add semantic markup in `index.html` (inside an appropriate `<section>`)
2. Add styles in `style.css` following existing naming conventions
3. Add any JS logic to `app.js`

### Modify barcode scanning behavior

All camera/scan logic lives in `scanner.js`. The scan interval (300ms) and ISBN validation regex (`/^97[89]\d{10}$/`) are the key tuning parameters.
