const express = require('express');
const fs = require('fs').promises;
const path = require('path');
const yaml = require('js-yaml');
const multer = require('multer');

const app = express();
const PORT = 3001;

// Paths
const POSTS_DIR = path.join(__dirname, 'posts');
const BOOKS_DATA_DIR = path.join(__dirname, '_data', 'books');
const COVERS_DIR = path.join(__dirname, 'assets', 'images', 'covers');

// Middleware
app.use(express.json());
app.use('/admin', express.static(path.join(__dirname, 'assets', 'admin')));
app.use('/assets', express.static(path.join(__dirname, 'assets')));

// Configure multer for image uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, COVERS_DIR);
  },
  filename: (req, file, cb) => {
    const slug = req.body.slug || 'book';
    const ext = path.extname(file.originalname);
    cb(null, `${slug}${ext}`);
  }
});
const upload = multer({ storage });

// Helper: Parse markdown frontmatter
function parseFrontmatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { data: {}, content: '' };
  
  const frontmatter = {};
  const lines = match[1].split('\n');
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.slice(0, colonIndex).trim();
      let value = line.slice(colonIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatter[key] = value;
    }
  }
  
  const bodyContent = content.slice(match[0].length).trim();
  return { data: frontmatter, content: bodyContent };
}

// Helper: Generate markdown frontmatter
function generateFrontmatter(data) {
  let yaml = '---\n';
  for (const [key, value] of Object.entries(data)) {
    if (value !== undefined && value !== null && value !== '') {
      yaml += `${key}: ${value}\n`;
    }
  }
  yaml += '---\n\n';
  return yaml;
}

// GET /api/books - List all books
app.get('/api/books', async (req, res) => {
  try {
    const files = await fs.readdir(POSTS_DIR);
    const books = [];
    
    for (const file of files) {
      if (file.endsWith('.md') && !file.startsWith('.')) {
        const content = await fs.readFile(path.join(POSTS_DIR, file), 'utf-8');
        const { data } = parseFrontmatter(content);
        const slug = file.replace('.md', '');
        
        // Count notes from YAML file
        let notesCount = 0;
        try {
          const yamlPath = path.join(BOOKS_DATA_DIR, `${data.book || slug}.yaml`);
          const yamlContent = await fs.readFile(yamlPath, 'utf-8');
          const yamlData = yaml.load(yamlContent);
          notesCount = yamlData?.notes?.filter(n => n.recipe)?.length || 0;
        } catch (e) {
          // YAML file may not exist yet
        }
        
        books.push({
          slug,
          ...data,
          notesCount
        });
      }
    }
    
    // Sort by date, newest first
    books.sort((a, b) => new Date(b.date) - new Date(a.date));
    res.json(books);
  } catch (error) {
    console.error('Error listing books:', error);
    res.status(500).json({ error: 'Failed to list books' });
  }
});

// GET /api/books/:slug - Get single book
app.get('/api/books/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const mdPath = path.join(POSTS_DIR, `${slug}.md`);
    const content = await fs.readFile(mdPath, 'utf-8');
    const { data } = parseFrontmatter(content);
    
    res.json({ slug, ...data });
  } catch (error) {
    console.error('Error getting book:', error);
    res.status(404).json({ error: 'Book not found' });
  }
});

// POST /api/books - Create new book
app.post('/api/books', async (req, res) => {
  try {
    const { slug, title, author, rating, progress, bookshop } = req.body;
    
    if (!slug || !title || !author) {
      return res.status(400).json({ error: 'slug, title, and author are required' });
    }
    
    // Check if book already exists
    const mdPath = path.join(POSTS_DIR, `${slug}.md`);
    try {
      await fs.access(mdPath);
      return res.status(409).json({ error: 'Book with this slug already exists' });
    } catch (e) {
      // File doesn't exist, good to proceed
    }
    
    // Create markdown file
    const frontmatter = {
      title,
      book: slug,
      author,
      date: new Date().toISOString(),
      rating: rating || '',
      progress: progress || '',
      bookshop: bookshop || '',
      png: `/assets/images/covers/${slug}.png`,
      webp: `/assets/images/covers/${slug}.webp`
    };
    
    await fs.writeFile(mdPath, generateFrontmatter(frontmatter));
    
    // Create YAML file with empty notes
    const yamlPath = path.join(BOOKS_DATA_DIR, `${slug}.yaml`);
    const yamlContent = yaml.dump({ notes: [] });
    await fs.writeFile(yamlPath, yamlContent);
    
    res.status(201).json({ message: 'Book created', slug });
  } catch (error) {
    console.error('Error creating book:', error);
    res.status(500).json({ error: 'Failed to create book' });
  }
});

// PUT /api/books/:slug - Update book
app.put('/api/books/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    const { title, author, rating, progress, bookshop } = req.body;
    
    const mdPath = path.join(POSTS_DIR, `${slug}.md`);
    const content = await fs.readFile(mdPath, 'utf-8');
    const { data } = parseFrontmatter(content);
    
    // Update frontmatter
    const updatedData = {
      ...data,
      title: title || data.title,
      author: author || data.author,
      rating: rating !== undefined ? rating : data.rating,
      progress: progress !== undefined ? progress : data.progress,
      bookshop: bookshop !== undefined ? bookshop : data.bookshop
    };
    
    await fs.writeFile(mdPath, generateFrontmatter(updatedData));
    res.json({ message: 'Book updated', slug });
  } catch (error) {
    console.error('Error updating book:', error);
    res.status(500).json({ error: 'Failed to update book' });
  }
});

// DELETE /api/books/:slug - Delete book
app.delete('/api/books/:slug', async (req, res) => {
  try {
    const { slug } = req.params;
    
    // Delete markdown file
    const mdPath = path.join(POSTS_DIR, `${slug}.md`);
    await fs.unlink(mdPath);
    
    // Delete YAML file
    try {
      const yamlPath = path.join(BOOKS_DATA_DIR, `${slug}.yaml`);
      await fs.unlink(yamlPath);
    } catch (e) {
      // YAML file may not exist
    }
    
    // Optionally delete cover images
    try {
      await fs.unlink(path.join(COVERS_DIR, `${slug}.png`));
      await fs.unlink(path.join(COVERS_DIR, `${slug}.webp`));
    } catch (e) {
      // Cover images may not exist
    }
    
    res.json({ message: 'Book deleted', slug });
  } catch (error) {
    console.error('Error deleting book:', error);
    res.status(500).json({ error: 'Failed to delete book' });
  }
});

// GET /api/books/:slug/notes - Get notes for a book
app.get('/api/books/:slug/notes', async (req, res) => {
  try {
    const { slug } = req.params;
    const yamlPath = path.join(BOOKS_DATA_DIR, `${slug}.yaml`);
    
    try {
      const content = await fs.readFile(yamlPath, 'utf-8');
      const data = yaml.load(content);
      res.json(data?.notes || []);
    } catch (e) {
      // File doesn't exist, return empty array
      res.json([]);
    }
  } catch (error) {
    console.error('Error getting notes:', error);
    res.status(500).json({ error: 'Failed to get notes' });
  }
});

// POST /api/books/:slug/notes - Add a note
app.post('/api/books/:slug/notes', async (req, res) => {
  try {
    const { slug } = req.params;
    const { text, recipe, rating } = req.body;
    
    if (!recipe) {
      return res.status(400).json({ error: 'recipe is required' });
    }
    
    const yamlPath = path.join(BOOKS_DATA_DIR, `${slug}.yaml`);
    let data = { notes: [] };
    
    try {
      const content = await fs.readFile(yamlPath, 'utf-8');
      data = yaml.load(content) || { notes: [] };
    } catch (e) {
      // File doesn't exist, create new
    }
    
    if (!data.notes) data.notes = [];
    
    const newNote = {
      text: text || '',
      recipe,
      rating: rating || ''
    };
    
    data.notes.push(newNote);
    await fs.writeFile(yamlPath, yaml.dump(data, { lineWidth: -1 }));
    
    res.status(201).json({ message: 'Note added', index: data.notes.length - 1 });
  } catch (error) {
    console.error('Error adding note:', error);
    res.status(500).json({ error: 'Failed to add note' });
  }
});

// PUT /api/books/:slug/notes/:index - Edit a note
app.put('/api/books/:slug/notes/:index', async (req, res) => {
  try {
    const { slug, index } = req.params;
    const { text, recipe, rating } = req.body;
    const noteIndex = parseInt(index, 10);
    
    const yamlPath = path.join(BOOKS_DATA_DIR, `${slug}.yaml`);
    const content = await fs.readFile(yamlPath, 'utf-8');
    const data = yaml.load(content);
    
    if (!data?.notes?.[noteIndex]) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    data.notes[noteIndex] = {
      text: text !== undefined ? text : data.notes[noteIndex].text,
      recipe: recipe !== undefined ? recipe : data.notes[noteIndex].recipe,
      rating: rating !== undefined ? rating : data.notes[noteIndex].rating
    };
    
    await fs.writeFile(yamlPath, yaml.dump(data, { lineWidth: -1 }));
    res.json({ message: 'Note updated' });
  } catch (error) {
    console.error('Error updating note:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
});

// DELETE /api/books/:slug/notes/:index - Delete a note
app.delete('/api/books/:slug/notes/:index', async (req, res) => {
  try {
    const { slug, index } = req.params;
    const noteIndex = parseInt(index, 10);
    
    const yamlPath = path.join(BOOKS_DATA_DIR, `${slug}.yaml`);
    const content = await fs.readFile(yamlPath, 'utf-8');
    const data = yaml.load(content);
    
    if (!data?.notes?.[noteIndex]) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    data.notes.splice(noteIndex, 1);
    await fs.writeFile(yamlPath, yaml.dump(data, { lineWidth: -1 }));
    res.json({ message: 'Note deleted' });
  } catch (error) {
    console.error('Error deleting note:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
});

// POST /api/upload-cover - Upload cover image
app.post('/api/upload-cover', upload.single('cover'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    res.json({ 
      message: 'Cover uploaded',
      path: `/assets/images/covers/${req.file.filename}`
    });
  } catch (error) {
    console.error('Error uploading cover:', error);
    res.status(500).json({ error: 'Failed to upload cover' });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`📚 Cookbook CMS running at http://localhost:${PORT}/admin/`);
  console.log(`   API available at http://localhost:${PORT}/api/`);
});
