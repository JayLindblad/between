// ── Supabase client ──
// SUPABASE_URL and SUPABASE_ANON_KEY are defined in config.js
const supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// ── Helpers ──
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
}

function normalizeISBN(raw) {
  return raw.replace(/[-\s]/g, '');
}

// ── State ──
let books = [];
let currentBook = null;

// ── Catalog ──
async function loadAndRenderCatalog() {
  const grid = document.getElementById('bookGrid');

  grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; font-style:italic; color:var(--ink-faint); padding:48px 0;">
    Loading the library…
  </p>`;

  const { data, error } = await supabase
    .from('books')
    .select('id, isbn, title, author, entries(count)')
    .order('created_at', { ascending: true });

  if (error) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--rust); padding:48px 0; font-style:italic;">
      Could not load the library. Please refresh.
    </p>`;
    return;
  }

  books = data.map(b => ({
    ...b,
    entryCount: b.entries[0]?.count ?? 0
  }));

  if (!books.length) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; font-style:italic; color:var(--ink-faint); padding:48px 0;">
      No books in the library yet.
    </p>`;
    return;
  }

  grid.innerHTML = books.map((book, i) => `
    <div class="book-card" onclick="openBookDirect(${book.id})">
      <p class="book-card-number">No. ${String(i + 1).padStart(2, '0')}</p>
      <h3 class="book-card-title">${escapeHtml(book.title)}</h3>
      <p class="book-card-author">${escapeHtml(book.author)}</p>
      <div class="book-card-footer">
        <span class="book-card-stops">
          <span class="book-card-status"></span>
          ${book.entryCount} ${book.entryCount === 1 ? 'stop' : 'stops'}
        </span>
        <span class="book-card-location">In the wild</span>
      </div>
      <div class="locked-notice">
        <span class="lock-icon">🔖</span>
        <span>ISBN required to read</span>
      </div>
    </div>
  `).join('');
}

// ── ISBN lookup ──
async function lookupISBN() {
  const raw = document.getElementById('isbnInput').value.trim();
  const isbn = normalizeISBN(raw);
  if (!isbn) return;

  const btn = document.querySelector('.isbn-btn');
  const resultEl = document.getElementById('bookResult');

  btn.textContent = 'Searching…';
  btn.disabled = true;

  const { data, error } = await supabase
    .from('books')
    .select('*, entries(*)')
    .eq('isbn', isbn)
    .maybeSingle();

  btn.textContent = 'Find It';
  btn.disabled = false;

  if (error) {
    document.getElementById('resultTitle').textContent = "Something went wrong";
    document.getElementById('resultAuthor').textContent = "Please try again";
    document.getElementById('resultStops').textContent = "";
    document.getElementById('viewJourneyBtn').style.display = 'none';
    resultEl.classList.add('visible');
    return;
  }

  if (data) {
    currentBook = data;
    document.getElementById('resultTitle').textContent = data.title;
    document.getElementById('resultAuthor').textContent = data.author;
    const count = data.entries.length;
    document.getElementById('resultStops').textContent =
      count === 0
        ? "No entries yet — you're the first"
        : `${count} ${count === 1 ? 'stop' : 'stops'} along the way`;
    document.getElementById('viewJourneyBtn').style.display = 'block';
    resultEl.classList.add('visible');
  } else {
    currentBook = null;
    document.getElementById('resultTitle').textContent = "Not in our library yet";
    document.getElementById('resultAuthor').textContent = "This book hasn't been registered with Between Readers. If you found a sticker on it, check back soon.";
    document.getElementById('resultStops').textContent = "";
    document.getElementById('viewJourneyBtn').style.display = 'none';
    resultEl.classList.add('visible');
  }
}

// Enter key on ISBN input
document.getElementById('isbnInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') lookupISBN();
});

// ── Open modal from catalog (ISBN-gated) ──
async function openBookDirect(id) {
  const isbn = prompt("Enter the ISBN from the back of the book to read its journey:");
  if (!isbn) return;

  const cleanIsbn = normalizeISBN(isbn);
  const cached = books.find(b => b.id === id);
  if (!cached || normalizeISBN(cached.isbn) !== cleanIsbn) {
    alert("That ISBN doesn't match this book.");
    return;
  }

  const { data, error } = await supabase
    .from('books')
    .select('*, entries(*)')
    .eq('id', id)
    .single();

  if (error || !data) {
    alert("Could not load this book's journey. Please try again.");
    return;
  }

  currentBook = data;
  openModal();
}

// ── Modal ──
function openModal() {
  if (!currentBook) return;
  const b = currentBook;
  const entries = b.entries || [];

  document.getElementById('modalTitle').textContent = b.title;
  document.getElementById('modalAuthor').textContent = b.author;

  const releaseNoteEl = document.querySelector('.modal-release-note');
  if (b.release_note) {
    document.getElementById('modalReleaseNote').textContent = `"${b.release_note}"`;
    document.getElementById('modalReleaseMeta').textContent = b.released_by ? `— ${b.released_by}` : '';
    releaseNoteEl.style.display = '';
  } else {
    releaseNoteEl.style.display = 'none';
  }

  const heading = document.getElementById('journeyHeading');
  heading.textContent = entries.length === 0
    ? 'No entries yet'
    : `The Journey · ${entries.length} ${entries.length === 1 ? 'stop' : 'stops'}`;

  const container = document.getElementById('journeyEntries');
  if (entries.length === 0) {
    container.innerHTML = `<p style="font-style:italic; color:var(--ink-faint); margin-bottom:24px;">This book is newly released. You might be the first to find it.</p>`;
  } else {
    const sorted = [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
    container.innerHTML = sorted.map((entry, i) => `
      <div class="journey-entry">
        <div class="entry-number">${i + 1}</div>
        <div class="entry-content">
          <div class="entry-header">
            <span class="entry-location">${escapeHtml(entry.location)}</span>
            <span class="entry-date">${formatDate(entry.found_at || entry.created_at)}</span>
          </div>
          <p class="entry-message">${escapeHtml(entry.message || '')}</p>
        </div>
      </div>
    `).join('');
  }

  resetEntryForm();

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
}

function resetEntryForm() {
  const section = document.querySelector('.add-entry-section');
  section.innerHTML = `
    <p class="add-entry-title">Add your chapter</p>
    <div class="form-field">
      <label class="form-label">Where did you find it?</label>
      <input class="form-input" id="entryLocation" type="text" placeholder="A coffee shop in Portland, a bench in Riverside Park…" />
    </div>
    <div class="form-field">
      <label class="form-label">When did you find it? <span style="font-style:italic; text-transform:none; letter-spacing:0;">(optional)</span></label>
      <input class="form-input" id="entryDate" type="date" />
    </div>
    <div class="form-field">
      <label class="form-label">Something to say</label>
      <textarea class="form-textarea" id="entryMessage" placeholder="About the book, the place, the moment, or anything at all…"></textarea>
    </div>
    <div class="form-field">
      <label class="form-label">A photo (optional)</label>
      <div class="photo-upload" onclick="this.querySelector('input').click()">
        <p class="photo-upload-text">📷 &nbsp; Tap to add a photo</p>
        <input type="file" accept="image/*" style="display:none" />
      </div>
    </div>
    <p id="entryError" style="color:var(--rust); font-style:italic; font-size:14px; min-height:20px; margin-top:4px;"></p>
    <button class="submit-entry-btn" id="submitEntryBtn" onclick="submitEntry()">Leave Your Mark</button>
  `;
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ── Submit entry ──
async function submitEntry() {
  if (!currentBook) return;

  const location = document.getElementById('entryLocation').value.trim();
  const message = document.getElementById('entryMessage').value.trim();
  const foundAt = document.getElementById('entryDate').value || null;
  const errorEl = document.getElementById('entryError');
  const btn = document.getElementById('submitEntryBtn');

  if (!location) {
    errorEl.textContent = 'Please tell us where you found it.';
    document.getElementById('entryLocation').focus();
    return;
  }

  errorEl.textContent = '';
  btn.textContent = 'Leaving your mark…';
  btn.disabled = true;

  const { error } = await supabase
    .from('entries')
    .insert({
      book_id: currentBook.id,
      location,
      message: message || null,
      found_at: foundAt
    });

  if (error) {
    btn.textContent = 'Leave Your Mark';
    btn.disabled = false;
    errorEl.textContent = 'Something went wrong. Please try again.';
    return;
  }

  const section = document.querySelector('.add-entry-section');
  section.innerHTML = `
    <div style="text-align:center; padding:40px 0;">
      <p style="font-family:'Cormorant Garamond',serif; font-size:26px; font-style:italic; color:var(--ink-light); margin-bottom:10px;">
        Your chapter has been added.
      </p>
      <p style="font-size:15px; color:var(--ink-faint); font-style:italic;">
        Thank you for leaving a mark. Leave the book somewhere new.
      </p>
    </div>
  `;

  setTimeout(() => closeModal(), 2500);
}

// ── Init ──
loadAndRenderCatalog();
