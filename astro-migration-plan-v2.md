# 11ty → Astro Migration Plan (Revised)
## notes.josephmos.es (Cook Notes)

---

## What's Changing vs the First Plan

| Topic | Original plan | This plan |
|---|---|---|
| Content format | Two files per book (`.md` + `.yaml`) | **One `.md` file per book** |
| Notes location | `_data/books/<slug>.yaml` | Embedded in frontmatter of `src/content/books/<slug>.md` |
| `+n` newlines | Replicate filter in Astro | **Migrated away entirely** — proper YAML multiline |
| `book: slug` field | Keep | **Dropped** — Astro uses filename as ID |
| Content Collections | Two (`books` + `bookNotes`) | **One** (`books`) |
| Admin server | Two files read/written per op | **One file read/written per op** |
| Data join logic | `getEntry('books') + getEntry('bookNotes')` | `getEntry('books')` — notes are already in it |

---

## New Project Structure

```
my-cook-notes/
├── src/
│   ├── content/
│   │   ├── content.config.ts         # Collection schema
│   │   └── books/                    # One .md file per book — metadata + notes
│   │       ├── dishoom.md
│   │       ├── ottolenghi-simple.md
│   │       └── ...
│   ├── layouts/
│   │   └── BaseLayout.astro
│   ├── components/
│   │   ├── Head.astro
│   │   ├── Header.astro
│   │   ├── Footer.astro
│   │   ├── PostContents.astro
│   │   └── Pagination.astro
│   └── pages/
│       ├── index.astro               # Home — paginated book covers
│       ├── all/
│       │   └── [...page].astro       # All notes, paginated
│       ├── book/
│       │   └── [slug].astro          # Individual book page
│       └── 404.astro
├── public/
│   └── assets/                       # Copied from assets/ — served as-is
│       ├── css/
│       ├── images/
│       ├── js/
│       ├── svgs/
│       └── admin/
├── admin-server.js                   # Updated (see Phase 7)
├── astro.config.mjs
├── src/content.config.ts
├── netlify.toml
└── package.json
```

---

## Unified Book File Format

Each book is now a single `.md` file. The frontmatter contains everything. The markdown body is empty (as it was before — the body was never used).

```yaml
# src/content/books/dishoom.md
---
title: Dishoom
author: Dishoom
date: 2023-07-30T23:00:00.000Z
rating: 4
progress: 2/130
bookshop: 9781408890677
png: /assets/images/covers/dishoom.png
webp: /assets/images/covers/dishoom.webp
notes:
  - recipe: Jackfruit Biryani
    rating: 5/5
    text: |-
      Modifications - roasted the marinated jackfruit and potatoes, not deep fried.

      This came out incredibly well and was lapped up in seconds.

      Much can be done during the "dead" time as it were.

      Very much a recipe I would make again with the same modifications.
  - recipe: House Black Daal
    rating: 5/5
    text: |-
      Having had this at the restaurant itself I had very high expectations.

      A surprisingly easy dish, where the only limiting factor is the long slow cook.
---
```

Books with no notes yet have `notes: []`. The `book: dishoom` field is gone — Astro derives the ID from the filename.

---

## Step-by-Step Migration

### Phase 1: Run the Migration Script

Two scripts are provided: one to migrate content, one that replaces `admin-server.js`.

**`migrate.js`** — reads all `posts/*.md` and `_data/books/*.yaml`, merges them into unified `src/content/books/*.md` files, and converts all `+n` markers to proper YAML multiline strings (`|-` block scalars). Run from the root of the old project:

```bash
# Install dependency if needed
npm install js-yaml

# Dry run first — prints output without writing
node migrate.js --dry-run

# When happy, run for real
node migrate.js
```

The script outputs to `astro-output/src/content/books/`. Copy that folder into your new Astro project.

**What `migrate.js` does:**
- Parses each `posts/<slug>.md` with `js-yaml` (not a hand-rolled parser)
- Strips the redundant `book: <slug>` field
- Reads `_data/books/<slug>.yaml` for that book's notes
- Converts `+n` markers to real `\n\n` paragraph breaks in note text
- Merges metadata + notes into a single frontmatter block
- Serialises with `yaml.dump()` so text fields become proper `|-` block scalars
- Handles books with empty YAML files (outputs `notes: []`)

**After running:** verify a handful of output files look right before proceeding.

---

### Phase 2: Scaffold the Astro Project

```bash
npm create astro@latest my-cook-notes
# Choose: Empty project, TypeScript: Strict, no Git yet

cd my-cook-notes
pnpm add @astrojs/netlify
pnpm add -D @types/js-yaml
```

**`astro.config.mjs`:**
```js
import { defineConfig } from 'astro/config';
import netlify from '@astrojs/netlify';

export default defineConfig({
  site: 'https://notes.josephmos.es',
  output: 'static',
  adapter: netlify(),
});
```

---

### Phase 3: Move Content and Assets

```bash
# Migrated book files (from migrate.js output)
cp -r astro-output/src/content/books src/content/

# Static assets
cp -r ../old-project/assets public/assets
```

---

### Phase 4: Content Collection Schema

**`src/content.config.ts`** — one collection, one schema:

```ts
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const books = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/books' }),
  schema: z.object({
    title: z.string(),
    author: z.string(),
    date: z.coerce.date(),
    rating: z.union([z.number(), z.string()]).optional(),
    progress: z.string().optional(),
    bookshop: z.union([z.number(), z.string()]).optional(),
    spoilers: z.boolean().optional(),
    png: z.string(),
    webp: z.string(),
    notes: z.array(z.object({
      recipe: z.string(),
      rating: z.union([z.string(), z.number()]).optional(),
      text: z.string().optional(),
      attribution: z.string().optional(),
    })).default([]),
  }),
});

export const collections = { books };
```

Run `pnpm astro sync` after creating this file — it generates the TypeScript types for your collections.

---

### Phase 5: Site Config

Replace `_data/site.json` with a typed module. Create **`src/config.ts`**:

```ts
export const SITE = {
  title: "Moose's Cook Notes",
  description: "Recipe notes and tweaks to suit my taste",
  url: "https://notes.josephmos.es",
  email: "hello@josephmos.es",
  author: "moose",
  authorUrl: "https://josephmos.es",
  twitter: "@youssefmousa",
} as const;
```

Import wherever needed: `import { SITE } from '../config';`

---

### Phase 6: Components

Port Nunjucks templates to Astro components. Key translation notes:

**`{% if x %}...{% endif %}`** → `{x && <element />}` or `{x ? <a /> : <b />}`

**`{{ value | url }}`** — the `| url` filter is not needed in Astro. Reference paths directly.

**`{{ value | escape }}`** — Astro escapes by default. Remove it.

**`{% include "x.njk" %}`** → `import X from '../components/X.astro'` then `<X />`

**`{% for item in items %}`** → `{items.map(item => ( ... ))}`

**`{{ content | safe }}`** (in default layout) → `<slot />`

**Note text rendering** — with `+n` gone, each note's `text` field contains real `\n\n` paragraph breaks. Render as paragraphs:

```astro
---
function renderNoteText(text: string): string {
  return text
    .split(/\n\n+/)
    .map(para => `<p>${para.trim()}</p>`)
    .join('');
}
---
<Fragment set:html={renderNoteText(note.text)} />
```

No custom filter, no find-replace hacks.

**`src/layouts/BaseLayout.astro`:**
```astro
---
import Head from '../components/Head.astro';
import Header from '../components/Header.astro';
import Footer from '../components/Footer.astro';

interface Props {
  title?: string;
  book?: { title: string; author: string; png: string };
}
const { title, book } = Astro.props;
---
<html lang="en">
  <Head title={title} book={book} />
  <body>
    <Header />
    <main role="main" class="page-wrap">
      <slot />
    </main>
    <Footer />
  </body>
</html>
```

---

### Phase 7: Pages

**`src/pages/index.astro`** — home page with paginated book covers:

```astro
---
import { getCollection } from 'astro:content';
import BaseLayout from '../layouts/BaseLayout.astro';
import Pagination from '../components/Pagination.astro';

export async function getStaticPaths({ paginate }) {
  const books = await getCollection('books');
  const sorted = books.sort((a, b) =>
    new Date(b.data.date).getTime() - new Date(a.data.date).getTime()
  );
  return paginate(sorted, { pageSize: 24 });
}

const { page } = Astro.props;
---
<BaseLayout title="Browse by book">
  <h1 class="u-vis-hidden">Explore all books</h1>
  <ul class="covers">
    {page.data.map((entry) => (
      <li class="cover">
        <a href={`/book/${entry.id}/`} class="book__image" title={entry.data.title}>
          <picture>
            <source type="image/webp" srcset={entry.data.webp} />
            <source type="image/png" srcset={entry.data.png} />
            <img src={entry.data.png} alt={`Cover of ${entry.data.title}`} width="240" />
          </picture>
        </a>
      </li>
    ))}
  </ul>
  <Pagination page={page} />
</BaseLayout>
```

**`src/pages/book/[slug].astro`** — individual book page. One query, no join:

```astro
---
import { getCollection, getEntry } from 'astro:content';
import BaseLayout from '../../layouts/BaseLayout.astro';
import PostContents from '../../components/PostContents.astro';

export async function getStaticPaths() {
  const books = await getCollection('books');
  return books.map(book => ({ params: { slug: book.id } }));
}

const { slug } = Astro.params;
const entry = await getEntry('books', slug);
if (!entry) return Astro.redirect('/404');

const { data } = entry;
---
<BaseLayout title={data.title} book={data}>
  <PostContents data={data} individualPost />
</BaseLayout>
```

Previously this required loading two separate files and joining on slug. Now it's one call.

**`src/pages/all/[...page].astro`** — all notes paginated. Similar to index but renders `PostContents` for each book in list mode rather than just covers, with `pageSize: 10`.

---

### Phase 8: Admin Server

The updated `admin-server.js` is provided as a drop-in replacement. Changes from the old version:

**Path changes (the core migration):**
```js
// Old paths
posts/            → src/content/books/
_data/books/      → (gone — notes are now in the .md file)
assets/           → public/assets/

// New — single path constant
const CONTENT_DIR = path.join(__dirname, 'src', 'content', 'books');
const COVERS_DIR  = path.join(__dirname, 'public', 'assets', 'images', 'covers');
```

**Simplified data model:** Every API call now reads/writes a single `.md` file. `GET /api/books/:slug/notes` reads the file and returns `data.notes`. `POST /api/books/:slug/notes` reads the file, pushes to `data.notes`, and writes it back. No second file, no separate YAML path.

**Improvements included:**
- `parseFrontmatter()` now uses `js-yaml` — not the old hand-rolled line parser that broke on multi-line values
- `serializeMd()` uses `yaml.dump()` so note text is serialised as proper block scalars, not escaped strings
- Added `/health` endpoint
- Added persistent logging to `admin-server.log`
- Added optional auth via `ADMIN_SECRET` env var (no-op when not set, so local dev is unchanged)
- Empty optional fields are omitted from output rather than written as `field: ''`
- Error responses use the correct HTTP status code (`404` vs `500`) based on whether the file was missing

**The `+n` issue in the admin UI (`book.js`):**  
The `formatNoteText()` function in `public/assets/admin/js/book.js` currently does `text.replace(/\+n/g, '<br><br>')` for display. After migration, notes will contain real newlines instead. Update that function:

```js
// Replace this
function formatNoteText(text) {
  if (!text) return '';
  return text.replace(/\+n/g, '<br><br>').substring(0, 300) + (text.length > 300 ? '...' : '');
}

// With this
function formatNoteText(text) {
  if (!text) return '';
  const truncated = text.length > 300 ? text.substring(0, 300) + '...' : text;
  return truncated
    .split(/\n\n+/)
    .map(p => `<p>${p.trim()}</p>`)
    .join('');
}
```

---

### Phase 9: Config Files

**`netlify.toml`:**
```toml
[build]
  command = "pnpm build"
  publish = "dist"

[[redirects]]
  from = "/404"
  to = "/404.html"
  status = 404
```
Remove the `netlify-plugin-html-validate` plugin — not needed with Astro's type-safe templates.

**`package.json`:**
```json
{
  "name": "cook-notes",
  "type": "module",
  "scripts": {
    "dev":     "astro dev",
    "build":   "astro build",
    "preview": "astro preview",
    "admin":   "node admin-server.js"
  },
  "dependencies": {
    "astro":            "^5.0.0",
    "@astrojs/netlify": "^5.0.0",
    "express":          "^4.21.0",
    "js-yaml":          "^4.1.0",
    "multer":           ">=2.0.2",
    "sharp":            "^0.33.0"
  },
  "devDependencies": {
    "@types/js-yaml": "^4.0.9"
  },
  "pnpm": {
    "ignoredBuiltDependencies": ["sharp"]
  }
}
```

---

## Manual Steps Checklist

### Content migration
- [ ] Run `node migrate.js --dry-run` from the old project root — review a few output files
- [ ] Run `node migrate.js` for real
- [ ] Spot-check: open 2–3 output `.md` files and verify notes look correct with proper paragraph breaks
- [ ] Confirm no `+n` remains: `grep -r '+n' astro-output/src/content/books/` should return nothing
- [ ] Confirm no `book:` fields remain: `grep -r '^book:' astro-output/src/content/books/` should return nothing

### Project setup
- [ ] Scaffold Astro project (`npm create astro@latest`)
- [ ] Copy `astro-output/src/content/books/` → `src/content/books/`
- [ ] Copy `assets/` → `public/assets/`
- [ ] Verify all cover images are present in `public/assets/images/covers/`
- [ ] Create `src/content.config.ts`
- [ ] Run `pnpm astro sync` — fix any schema validation errors before proceeding
- [ ] Create `src/config.ts`

### Templates and pages
- [ ] Port `_includes/head.njk` → `src/components/Head.astro`
- [ ] Port `_includes/header.njk` → `src/components/Header.astro`
- [ ] Port `_includes/footer.njk` → `src/components/Footer.astro`
- [ ] Port `_includes/pagination.njk` → `src/components/Pagination.astro`
- [ ] Port `_includes/post-contents.njk` → `src/components/PostContents.astro` (update text rendering)
- [ ] Create `src/layouts/BaseLayout.astro`
- [ ] Create `src/pages/index.astro`
- [ ] Create `src/pages/all/[...page].astro`
- [ ] Create `src/pages/book/[slug].astro`
- [ ] Create `src/pages/404.astro`

### Admin server
- [ ] Replace `admin-server.js` with the updated version
- [ ] Update `formatNoteText()` in `public/assets/admin/js/book.js`
- [ ] Test: `node admin-server.js` — create a test book, add a note, edit it, delete it
- [ ] Confirm the written `.md` file contains proper YAML block scalars (no `+n`)

### Final checks
- [ ] `pnpm dev` — verify `/`, `/book/dishoom/`, `/all/` all render correctly
- [ ] Verify permalink hash links work (highlight activation JS in `scripts.js`)
- [ ] Verify cover images load
- [ ] Verify Bookshop links render correctly
- [ ] `pnpm build` — check for any build errors or schema warnings
- [ ] Deploy to a Netlify preview branch before merging to main
- [ ] Once confirmed working: delete `posts/` and `_data/` from the old project

---

## What You Get

- **One file per book** instead of two — everything in one place, no join key needed
- **Proper YAML multiline strings** — note text is readable in the raw files, no encoding artifacts
- **Single Content Collection** — simpler schema, simpler queries, no two-collection join
- **Type-safe throughout** — Zod schema catches malformed frontmatter at build time
- **Simpler admin server** — one file read/write per operation, better error handling, persistent logs
- **Same public output** — fully static HTML, same URL structure, same Netlify deployment
