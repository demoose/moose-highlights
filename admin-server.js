const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const multer = require('multer');
const sharp = require('sharp');

const app = express();
const PORT = process.env.PORT || 3001;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

// ─── Paths ────────────────────────────────────────────────────────────────────

const CONTENT_DIR = path.join(__dirname, 'src', 'content', 'books');
const COVERS_DIR  = path.join(__dirname, 'public', 'assets', 'images', 'covers');
const ASSETS_DIR  = path.join(__dirname, 'public', 'assets');
const ADMIN_DIR   = path.join(ASSETS_DIR, 'admin');

// ─── Middleware ───────────────────────────────────────────────────────────────

app.use(express.json());
app.use('/admin', express.static(ADMIN_DIR));
app.use('/assets', express.static(ASSETS_DIR));

// Auth — only enforced when ADMIN_SECRET env var is set.
// Set it before exposing the server beyond localhost.
app.use('/api', (req, res, next) => {
  if (!ADMIN_SECRET) return next();
  if (req.headers['x-admin-secret'] !== ADMIN_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
});

// ─── Logging ──────────────────────────────────────────────────────────────────

const LOG_FILE = path.join(__dirname, 'admin-server.log');

async function log(msg) {
  const entry = `[${new Date().toISOString()}] ${msg}\n`;
  process.stdout.write(entry);
  await fs.appendFile(LOG_FILE, entry).catch(() => {});
}

// ─── Image upload ─────────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (allowed.includes(file.mimetype)) return cb(null, true);
    cb(new Error('Invalid file type. Only JPEG, PNG, WebP, and GIF are allowed.'));
  },
});

// ─── Frontmatter helpers ──────────────────────────────────────────────────────

/**
 * Parse frontmatter from a markdown file.
 * Uses js-yaml — not a hand-rolled parser.
 */
function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, body: '' };
  return {
    data: yaml.load(match[1]) ?? {},
    body: fileContent.slice(match[0].length).trim(),
  };
}

/**
 * Serialize data back to a .md file with a YAML frontmatter block.
 */
function serializeMd(data, body = '') {
  const front = yaml.dump(data, { lineWidth: -1, quotingType: '"', forceQuotes: false });
  return `---\n${front}---\n${body ? `\n${body}\n` : ''}`;
}

// ─── Slug helper ──────────────────────────────────────────────────────────────

function slugify(text) {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function isValidSlug(slug) {
  return typeof slug === 'string' && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug);
}

function validateSlugOrRespond(slug, res) {
  if (isValidSlug(slug)) return true;
  res.status(400).json({ error: 'Invalid slug' });
  return false;
}

// ─── File path helper ─────────────────────────────────────────────────────────

function bookPath(slug) {
  return path.join(CONTENT_DIR, `${slug}.md`);
}

async function logStartupPathState() {
  try {
    await fs.access(CONTENT_DIR);
    await log(`   ✅ Content directory: ${CONTENT_DIR}`);
  } catch {
    await log(`   ⚠️  Content directory missing: ${CONTENT_DIR}`);
  }

  try {
    await fs.mkdir(COVERS_DIR, { recursive: true });
    await log(`   ✅ Covers directory ready: ${COVERS_DIR}`);
  } catch (err) {
    await log(`   ⚠️  Could not prepare covers directory (${COVERS_DIR}): ${err.message}`);
  }

  try {
    await fs.access(ADMIN_DIR);
    await log(`   ✅ Admin directory: ${ADMIN_DIR}`);
  } catch {
    await log(`   ⚠️  Admin directory missing: ${ADMIN_DIR}`);
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// ─── GET /api/books ───────────────────────────────────────────────────────────

app.get('/api/books', async (_req, res) => {
  try {
    const files = await fs.readdir(CONTENT_DIR);
    const books = [];

    for (const file of files) {
      if (!file.endsWith('.md') || file.startsWith('.')) continue;
      const content = await fs.readFile(path.join(CONTENT_DIR, file), 'utf-8');
      const { data } = parseFrontmatter(content);
      const slug = file.replace(/\.md$/, '');
      books.push({
        slug,
        ...data,
        notesCount: data.notes?.filter(n => n.recipe)?.length ?? 0,
      });
    }

    books.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(books);
  } catch (err) {
    await log(`ERROR GET /api/books: ${err.message}`);
    res.status(500).json({ error: 'Failed to list books' });
  }
});

// ─── GET /api/books/:slug ─────────────────────────────────────────────────────

app.get('/api/books/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;
    const content = await fs.readFile(bookPath(slug), 'utf-8');
    const { data } = parseFrontmatter(content);
    res.json({ slug, ...data });
  } catch {
    res.status(404).json({ error: 'Book not found' });
  }
});

// ─── POST /api/books ──────────────────────────────────────────────────────────

app.post('/api/books', async (req, res) => {
  try {
    let { slug, title, author, rating, progress, bookshop } = req.body;

    if (!title || !author) {
      return res.status(400).json({ error: 'title and author are required' });
    }

    slug = slugify(slug || title);
    if (!slug) {
      return res.status(400).json({ error: 'Could not derive a valid slug' });
    }

    const filePath = bookPath(slug);
    try {
      await fs.access(filePath);
      return res.status(409).json({ error: `Book "${slug}" already exists` });
    } catch {
      // Expected — file doesn't exist yet
    }

    const data = {
      title,
      author,
      date: new Date().toISOString(),
      ...(rating    ? { rating }    : {}),
      ...(progress  ? { progress }  : {}),
      ...(bookshop  ? { bookshop }  : {}),
      png:  `/assets/images/covers/${slug}.png`,
      webp: `/assets/images/covers/${slug}.webp`,
      notes: [],
    };

    await fs.writeFile(filePath, serializeMd(data), 'utf-8');
    await log(`Created book: ${slug}`);
    res.status(201).json({ message: 'Book created', slug });
  } catch (err) {
    await log(`ERROR POST /api/books: ${err.message}`);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// ─── PUT /api/books/:slug ─────────────────────────────────────────────────────

app.put('/api/books/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;
    const { title, author, rating, progress, bookshop } = req.body;

    const filePath = bookPath(slug);
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, body } = parseFrontmatter(content);

    // Merge — only update fields that were explicitly provided
    if (title    !== undefined) data.title    = title;
    if (author   !== undefined) data.author   = author;
    if (rating   !== undefined) data.rating   = rating;
    if (progress !== undefined) data.progress = progress;
    if (bookshop !== undefined) data.bookshop = bookshop;

    await fs.writeFile(filePath, serializeMd(data, body), 'utf-8');
    await log(`Updated book: ${slug}`);
    res.json({ message: 'Book updated', slug });
  } catch (err) {
    await log(`ERROR PUT /api/books/${req.params.slug}: ${err.message}`);
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: 'Failed to update book' });
  }
});

// ─── DELETE /api/books/:slug ──────────────────────────────────────────────────

app.delete('/api/books/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;

    await fs.unlink(bookPath(slug));

    // Best-effort cover cleanup
    for (const ext of ['png', 'webp']) {
      await fs.unlink(path.join(COVERS_DIR, `${slug}.${ext}`)).catch(() => {});
    }

    await log(`Deleted book: ${slug}`);
    res.json({ message: 'Book deleted', slug });
  } catch (err) {
    await log(`ERROR DELETE /api/books/${req.params.slug}: ${err.message}`);
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: 'Failed to delete book' });
  }
});

// ─── GET /api/books/:slug/notes ───────────────────────────────────────────────

app.get('/api/books/:slug/notes', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;
    const content = await fs.readFile(bookPath(slug), 'utf-8');
    const { data } = parseFrontmatter(content);
    res.json(data.notes ?? []);
  } catch {
    res.status(404).json({ error: 'Book not found' });
  }
});

// ─── POST /api/books/:slug/notes ─────────────────────────────────────────────

app.post('/api/books/:slug/notes', async (req, res) => {
  try {
    const { slug } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;
    const { text, recipe, rating } = req.body;

    if (!recipe) {
      return res.status(400).json({ error: 'recipe is required' });
    }

    const filePath = bookPath(slug);
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, body } = parseFrontmatter(content);

    if (!Array.isArray(data.notes)) data.notes = [];

    const newNote = { recipe, ...(rating ? { rating } : {}), ...(text ? { text } : {}) };
    data.notes.push(newNote);

    await fs.writeFile(filePath, serializeMd(data, body), 'utf-8');
    await log(`Added note to ${slug}: "${recipe}"`);
    res.status(201).json({ message: 'Note added', index: data.notes.length - 1 });
  } catch (err) {
    await log(`ERROR POST /api/books/${req.params.slug}/notes: ${err.message}`);
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: 'Failed to add note' });
  }
});

// ─── PUT /api/books/:slug/notes/:index ───────────────────────────────────────

app.put('/api/books/:slug/notes/:index', async (req, res) => {
  try {
    const { slug, index } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;
    const noteIndex = parseInt(index, 10);
    const { text, recipe, rating } = req.body;

    const filePath = bookPath(slug);
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, body } = parseFrontmatter(content);

    if (!data.notes?.[noteIndex]) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const existing = data.notes[noteIndex];
    data.notes[noteIndex] = {
      recipe:  recipe  !== undefined ? recipe  : existing.recipe,
      ...(rating !== undefined
        ? (rating ? { rating } : {})
        : (existing.rating ? { rating: existing.rating } : {})),
      ...(text !== undefined
        ? (text ? { text } : {})
        : (existing.text ? { text: existing.text } : {})),
    };

    await fs.writeFile(filePath, serializeMd(data, body), 'utf-8');
    await log(`Updated note ${noteIndex} in ${slug}`);
    res.json({ message: 'Note updated' });
  } catch (err) {
    await log(`ERROR PUT /api/books/${req.params.slug}/notes/${req.params.index}: ${err.message}`);
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: 'Failed to update note' });
  }
});

// ─── DELETE /api/books/:slug/notes/:index ────────────────────────────────────

app.delete('/api/books/:slug/notes/:index', async (req, res) => {
  try {
    const { slug, index } = req.params;
    if (!validateSlugOrRespond(slug, res)) return;
    const noteIndex = parseInt(index, 10);

    const filePath = bookPath(slug);
    const content = await fs.readFile(filePath, 'utf-8');
    const { data, body } = parseFrontmatter(content);

    if (!data.notes?.[noteIndex]) {
      return res.status(404).json({ error: 'Note not found' });
    }

    const removed = data.notes.splice(noteIndex, 1)[0];
    await fs.writeFile(filePath, serializeMd(data, body), 'utf-8');
    await log(`Deleted note ${noteIndex} ("${removed.recipe}") from ${slug}`);
    res.json({ message: 'Note deleted' });
  } catch (err) {
    await log(`ERROR DELETE /api/books/${req.params.slug}/notes/${req.params.index}: ${err.message}`);
    res.status(err.code === 'ENOENT' ? 404 : 500).json({ error: 'Failed to delete note' });
  }
});

// ─── POST /api/upload-cover ───────────────────────────────────────────────────

app.post('/api/upload-cover', upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const slug = slugify(req.body.slug ?? '');
    if (!slug || !isValidSlug(slug)) {
      return res.status(400).json({ error: 'slug is required' });
    }

    const buf = req.file.buffer;

    await sharp(buf)
      .resize(800, null, { withoutEnlargement: true, fit: 'inside' })
      .png({ quality: 85, compressionLevel: 9 })
      .toFile(path.join(COVERS_DIR, `${slug}.png`));

    await sharp(buf)
      .resize(800, null, { withoutEnlargement: true, fit: 'inside' })
      .webp({ quality: 80, effort: 6 })
      .toFile(path.join(COVERS_DIR, `${slug}.webp`));

    await log(`Uploaded cover for: ${slug}`);
    res.json({
      message: 'Cover uploaded and optimised',
      png:  `/assets/images/covers/${slug}.png`,
      webp: `/assets/images/covers/${slug}.webp`,
    });
  } catch (err) {
    await log(`ERROR POST /api/upload-cover: ${err.message}`);
    res.status(500).json({ error: `Failed to upload cover: ${err.message}` });
  }
});

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  await log(`📚 Cookbook CMS running at http://localhost:${PORT}/admin/`);
  await log(`   API available at http://localhost:${PORT}/api/`);
  await logStartupPathState();
  if (!ADMIN_SECRET) {
    await log('   ⚠️  ADMIN_SECRET not set — API is unprotected. Fine for local use only.');
  }
});
