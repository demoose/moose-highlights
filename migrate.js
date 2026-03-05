#!/usr/bin/env node
/**
 * Migration script: 11ty → Astro content format
 *
 * For each book this script:
 *   1. Reads posts/<slug>.md  (book metadata)
 *   2. Reads _data/books/<slug>.yaml  (notes)
 *   3. Converts all +n markers to real newlines in note text
 *   4. Merges everything into a single src/content/books/<slug>.md
 *      with notes embedded directly in frontmatter
 *   5. Drops the redundant `book: <slug>` frontmatter field
 *
 * Run from the ROOT of your new Astro project, with the old project
 * content available at OLD_ROOT below.
 *
 * Usage:
 *   node migrate.js
 *   node migrate.js --dry-run   (print output, write nothing)
 */

const fs = require('fs');
const path = require('path');
const yaml = require('js-yaml');

// ─── Config ──────────────────────────────────────────────────────────────────

const DRY_RUN = process.argv.includes('--dry-run');

// Adjust these paths to match where you've placed the old and new projects
const OLD_ROOT = __dirname;                                  // old 11ty project (content at repo root)
const NEW_ROOT = path.join(__dirname, 'astro-output');      // new Astro project

const OLD_POSTS_DIR     = path.join(OLD_ROOT, 'posts');
const OLD_BOOKS_DIR     = path.join(OLD_ROOT, '_data', 'books');
const NEW_CONTENT_DIR   = path.join(NEW_ROOT, 'src', 'content', 'books');

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Parse frontmatter from a markdown file.
 * Uses js-yaml for correctness — not a hand-rolled parser.
 */
function parseFrontmatter(fileContent) {
  const match = fileContent.match(/^---\r?\n([\s\S]*?)\r?\n---/);
  if (!match) return { data: {}, body: fileContent.trim() };
  const data = yaml.load(match[1]) ?? {};
  const body = fileContent.slice(match[0].length).trim();
  return { data, body };
}

/**
 * Convert +n markers to real paragraph breaks.
 *
 * The old format used +n (with optional trailing space due to YAML
 * multiline folding) as a paragraph separator. We replace each
 * occurrence with a blank line so the text becomes proper paragraphs.
 */
function convertPlusN(text) {
  if (!text) return '';
  // +n may have been followed by a space due to YAML block folding
  return text
    .replace(/\+n\s*/g, '\n\n')
    .trim();
}

/**
 * Serialize the final merged data back to a .md file.
 * Uses js-yaml for the frontmatter block so multiline strings
 * are emitted as proper YAML block scalars (|), not escaped strings.
 */
function serializeMd(frontmatterData, body = '') {
  const frontmatter = yaml.dump(frontmatterData, {
    lineWidth: -1,       // don't wrap long lines
    quotingType: '"',    // use double quotes where quoting is needed
    forceQuotes: false,
  });
  const bodySection = body ? `\n${body}\n` : '';
  return `---\n${frontmatter}---\n${bodySection}`;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

function migrate() {
  if (DRY_RUN) console.log('DRY RUN — no files will be written.\n');

  if (!DRY_RUN) {
    fs.mkdirSync(NEW_CONTENT_DIR, { recursive: true });
  }

  // Get all markdown post files (skip hidden/blank files)
  const postFiles = fs.readdirSync(OLD_POSTS_DIR)
    .filter(f => f.endsWith('.md') && !f.startsWith('.'));

  let successCount = 0;
  let warnCount = 0;

  for (const postFile of postFiles) {
    const slug = postFile.replace(/\.md$/, '');
    const mdPath   = path.join(OLD_POSTS_DIR, postFile);
    const yamlPath = path.join(OLD_BOOKS_DIR, `${slug}.yaml`);

    console.log(`\nProcessing: ${slug}`);

    // ── 1. Read and parse the markdown metadata file ──
    const mdContent = fs.readFileSync(mdPath, 'utf-8');
    const { data: metadata } = parseFrontmatter(mdContent);

    // ── 2. Drop the redundant `book` field ──
    // The filename (slug) is the canonical ID in Astro.
    // `png` and `webp` paths encode the slug too, so they stay for now
    // but could also be derived at build time if you want to slim further.
    delete metadata.book;

    // ── 3. Read and parse the YAML notes file ──
    let notes = [];
    if (fs.existsSync(yamlPath)) {
      const yamlContent = fs.readFileSync(yamlPath, 'utf-8');
      const yamlData = yaml.load(yamlContent);
      notes = yamlData?.notes ?? [];
    } else {
      console.warn(`  ⚠️  No YAML file found for ${slug} — notes will be empty`);
      warnCount++;
    }

    // ── 4. Convert +n to real newlines in all note text fields ──
    const convertedNotes = notes.map(note => ({
      ...note,
      text: convertPlusN(note.text),
    }));

    // Verify no +n remain (sanity check)
    const residual = convertedNotes.filter(n => n.text.includes('+n'));
    if (residual.length > 0) {
      console.warn(`  ⚠️  ${residual.length} note(s) still contain +n after conversion`);
      warnCount++;
    }

    // ── 5. Merge notes into frontmatter ──
    const mergedData = {
      ...metadata,
      notes: convertedNotes,
    };

    // ── 6. Serialize to new .md file ──
    const outputContent = serializeMd(mergedData);
    const outputPath = path.join(NEW_CONTENT_DIR, `${slug}.md`);

    if (DRY_RUN) {
      console.log(`  → Would write to: ${outputPath}`);
      console.log('  Preview (first 400 chars):');
      console.log(outputContent.slice(0, 400));
      console.log('  ...');
    } else {
      fs.writeFileSync(outputPath, outputContent, 'utf-8');
      console.log(`  ✅ Written: src/content/books/${slug}.md (${convertedNotes.length} notes)`);
    }

    successCount++;
  }

  console.log(`\n${'─'.repeat(50)}`);
  console.log(`Migration complete: ${successCount} books processed, ${warnCount} warnings.`);
  if (!DRY_RUN) {
    console.log(`\nOutput: ${NEW_CONTENT_DIR}`);
    console.log('\nNext steps:');
    console.log('  1. Review a few output files to confirm formatting looks right');
    console.log('  2. Copy src/content/books/ into your Astro project');
    console.log('  3. Delete the old posts/ and _data/books/ directories');
  }
}

migrate();
