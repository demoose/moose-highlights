// Book Detail Page JavaScript

const API_BASE = '/api';

// Get slug from URL
const urlParams = new URLSearchParams(window.location.search);
const slug = urlParams.get('slug');

if (!slug) {
  window.location.href = 'index.html';
}

// DOM Elements
const bookTitle = document.getElementById('bookTitle');
const bookInfo = document.getElementById('bookInfo');
const notesList = document.getElementById('notesList');
const editBookBtn = document.getElementById('editBookBtn');
const deleteBookBtn = document.getElementById('deleteBookBtn');
const addNoteBtn = document.getElementById('addNoteBtn');
const bookModal = document.getElementById('bookModal');
const bookForm = document.getElementById('bookForm');
const closeBookModal = document.getElementById('closeBookModal');
const cancelBookBtn = document.getElementById('cancelBookBtn');
const noteModal = document.getElementById('noteModal');
const noteForm = document.getElementById('noteForm');
const closeNoteModal = document.getElementById('closeNoteModal');
const cancelNoteBtn = document.getElementById('cancelNoteBtn');
const noteModalTitle = document.getElementById('noteModalTitle');
const noteIndex = document.getElementById('noteIndex');
const toast = document.getElementById('toast');

// State
let book = null;
let notes = [];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadBook();
  loadNotes();
  setupEventListeners();
});

// Event Listeners
function setupEventListeners() {
  editBookBtn.addEventListener('click', openEditBookModal);
  deleteBookBtn.addEventListener('click', handleDeleteBook);
  addNoteBtn.addEventListener('click', () => openNoteModal());
  
  closeBookModal.addEventListener('click', () => bookModal.classList.remove('active'));
  cancelBookBtn.addEventListener('click', () => bookModal.classList.remove('active'));
  bookForm.addEventListener('submit', handleBookFormSubmit);
  
  closeNoteModal.addEventListener('click', () => noteModal.classList.remove('active'));
  cancelNoteBtn.addEventListener('click', () => noteModal.classList.remove('active'));
  noteForm.addEventListener('submit', handleNoteFormSubmit);
  
  // Close modals on backdrop click
  bookModal.addEventListener('click', (e) => {
    if (e.target === bookModal) bookModal.classList.remove('active');
  });
  noteModal.addEventListener('click', (e) => {
    if (e.target === noteModal) noteModal.classList.remove('active');
  });
}

// Load Book
async function loadBook() {
  try {
    const response = await fetch(`${API_BASE}/books/${slug}`);
    if (!response.ok) throw new Error('Book not found');
    book = await response.json();
    renderBookInfo();
  } catch (error) {
    console.error('Error loading book:', error);
    bookInfo.innerHTML = '<div class="empty-state">Book not found</div>';
  }
}

// Render Book Info
function renderBookInfo() {
  bookTitle.textContent = book.title;
  document.title = `${book.title} - Cookbook CMS`;
  
  bookInfo.innerHTML = `
    <img 
      class="book-info-cover" 
      src="${book.webp || book.png || ''}" 
      alt="Cover of ${book.title}"
      onerror="this.style.display='none'"
    >
    <div class="book-info-details">
      <h2>${book.title}</h2>
      <p class="book-info-author">by ${book.author}</p>
      <div class="book-info-meta">
        ${book.rating ? `<div><label>Rating</label>${book.rating} ⭐</div>` : ''}
        ${book.progress ? `<div><label>Progress</label>${book.progress}</div>` : ''}
        ${book.bookshop ? `<div><label>ISBN</label>${book.bookshop}</div>` : ''}
      </div>
    </div>
  `;
}

// Load Notes
async function loadNotes() {
  try {
    const response = await fetch(`${API_BASE}/books/${slug}/notes`);
    notes = await response.json();
    renderNotes();
  } catch (error) {
    console.error('Error loading notes:', error);
    notesList.innerHTML = '<div class="empty-state">Failed to load notes</div>';
  }
}

// Render Notes
function renderNotes() {
  // Filter out empty notes
  const validNotes = notes.filter(note => note && note.recipe);
  
  if (validNotes.length === 0) {
    notesList.innerHTML = `
      <div class="empty-state">
        <p>No recipe notes yet. Add your first note!</p>
      </div>
    `;
    return;
  }
  
  notesList.innerHTML = validNotes.map((note, index) => `
    <div class="note-card" data-index="${index}">
      <div class="note-header">
        <span class="note-recipe">${note.recipe}</span>
        ${note.rating ? `<span class="note-rating">${note.rating}</span>` : ''}
      </div>
      ${note.text ? `<p class="note-text">${formatNoteText(note.text)}</p>` : ''}
      <div class="note-actions">
        <button class="btn btn-secondary btn-sm" onclick="openNoteModal(${index})">Edit</button>
        <button class="btn btn-danger btn-sm" onclick="handleDeleteNote(${index})">Delete</button>
      </div>
    </div>
  `).join('');
}

// Format note text (replace +n with line breaks for display)
function formatNoteText(text) {
  if (!text) return '';
  return text.replace(/\+n/g, '<br><br>').substring(0, 300) + (text.length > 300 ? '...' : '');
}

// Open Edit Book Modal
function openEditBookModal() {
  document.getElementById('bookTitleInput').value = book.title || '';
  document.getElementById('bookAuthor').value = book.author || '';
  document.getElementById('bookRating').value = book.rating || '';
  document.getElementById('bookProgress').value = book.progress || '';
  document.getElementById('bookBookshop').value = book.bookshop || '';
  bookModal.classList.add('active');
}

// Handle Book Form Submit
async function handleBookFormSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(bookForm);
  const bookData = {
    title: formData.get('title'),
    author: formData.get('author'),
    rating: formData.get('rating'),
    progress: formData.get('progress'),
    bookshop: formData.get('bookshop')
  };
  
  try {
    const response = await fetch(`${API_BASE}/books/${slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bookData)
    });
    
    if (!response.ok) throw new Error('Failed to update book');
    
    showToast('Book updated successfully!', 'success');
    bookModal.classList.remove('active');
    loadBook();
  } catch (error) {
    console.error('Error updating book:', error);
    showToast('Failed to update book', 'error');
  }
}

// Handle Delete Book
async function handleDeleteBook() {
  if (!confirm(`Are you sure you want to delete "${book.title}"? This will also delete all notes.`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/books/${slug}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete book');
    
    showToast('Book deleted', 'success');
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1000);
  } catch (error) {
    console.error('Error deleting book:', error);
    showToast('Failed to delete book', 'error');
  }
}

// Open Note Modal
function openNoteModal(index = null) {
  noteForm.reset();
  
  if (index !== null && notes[index]) {
    noteModalTitle.textContent = 'Edit Recipe Note';
    noteIndex.value = index;
    document.getElementById('noteRecipe').value = notes[index].recipe || '';
    document.getElementById('noteRating').value = notes[index].rating || '';
    document.getElementById('noteText').value = notes[index].text || '';
  } else {
    noteModalTitle.textContent = 'Add Recipe Note';
    noteIndex.value = '';
  }
  
  noteModal.classList.add('active');
}

// Handle Note Form Submit
async function handleNoteFormSubmit(e) {
  e.preventDefault();
  
  const formData = new FormData(noteForm);
  const noteData = {
    recipe: formData.get('recipe'),
    rating: formData.get('rating'),
    text: formData.get('text')
  };
  
  const editIndex = noteIndex.value;
  const isEdit = editIndex !== '';
  
  try {
    const url = isEdit 
      ? `${API_BASE}/books/${slug}/notes/${editIndex}`
      : `${API_BASE}/books/${slug}/notes`;
    
    const response = await fetch(url, {
      method: isEdit ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(noteData)
    });
    
    if (!response.ok) throw new Error('Failed to save note');
    
    showToast(isEdit ? 'Note updated!' : 'Note added!', 'success');
    noteModal.classList.remove('active');
    loadNotes();
  } catch (error) {
    console.error('Error saving note:', error);
    showToast('Failed to save note', 'error');
  }
}

// Handle Delete Note
async function handleDeleteNote(index) {
  const note = notes[index];
  if (!confirm(`Delete the note for "${note.recipe}"?`)) {
    return;
  }
  
  try {
    const response = await fetch(`${API_BASE}/books/${slug}/notes/${index}`, {
      method: 'DELETE'
    });
    
    if (!response.ok) throw new Error('Failed to delete note');
    
    showToast('Note deleted', 'success');
    loadNotes();
  } catch (error) {
    console.error('Error deleting note:', error);
    showToast('Failed to delete note', 'error');
  }
}

// Toast Notification
function showToast(message, type = 'info') {
  toast.textContent = message;
  toast.className = `toast ${type} show`;
  
  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}
