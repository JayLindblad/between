// ── Supabase client ──
// Use the client already created by config.js if it exists (avoids re-declaration
// conflicts when config.js declares its own `const supabase = createClient(...)`).
let db;
try {
  db = (typeof supabase !== 'undefined' && supabase && supabase.auth)
    ? supabase
    : window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
} catch (e) {
  console.error('[admin] Supabase init failed:', e);
}

// ── Helpers ──
function escapeHtml(str) {
  if (!str) return '';
  const d = document.createElement('div');
  d.textContent = str;
  return d.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr.includes('T') ? dateStr : dateStr + 'T12:00:00');
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function normalizeISBN(raw) {
  return raw.replace(/[-\s]/g, '');
}

// ── Auth ──
function showLoginScreen() {
  document.getElementById('loginScreen').style.display = 'flex';
  document.getElementById('adminPanel').style.display = 'none';
}

function showAdminPanel() {
  document.getElementById('loginScreen').style.display = 'none';
  document.getElementById('adminPanel').style.display = 'block';
  loadAll();
}

async function adminLogin() {
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value;
  const errorEl = document.getElementById('loginError');
  const btn = document.getElementById('loginBtn');

  if (!email || !password) {
    errorEl.textContent = 'Please enter your email and password.';
    return;
  }

  if (!db) {
    errorEl.textContent = 'Configuration error — check that config.js exists and Supabase credentials are correct.';
    return;
  }

  errorEl.textContent = '';
  btn.textContent = 'Signing in\u2026';
  btn.disabled = true;

  try {
    const { error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      errorEl.textContent = error.message;
    } else {
      showAdminPanel();
    }
  } catch (e) {
    errorEl.textContent = 'Could not connect. Check your internet connection.';
  } finally {
    btn.textContent = 'Sign In';
    btn.disabled = false;
  }
}

async function adminLogout() {
  await db.auth.signOut();
  showLoginScreen();
}

function togglePasswordVisibility() {
  const input = document.getElementById('loginPassword');
  const icon = document.getElementById('eyeIcon');
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  // swap to eye-off icon when visible
  icon.innerHTML = show
    ? '<path d="M17.94 17.94A10.1 10.1 0 0 1 12 20c-6.5 0-10-8-10-8a18.1 18.1 0 0 1 5.06-6.94M9.9 4.24A9.1 9.1 0 0 1 12 4c6.5 0 10 8 10 8a18.4 18.4 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>'
    : '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z"/><circle cx="12" cy="12" r="3"/>';
}

// Enter key on login form
document.getElementById('loginPassword').addEventListener('keydown', e => {
  if (e.key === 'Enter') adminLogin();
});

// ── Auth state — restore session on page reload ──
db.auth.getSession().then(({ data: { session } }) => {
  if (session) showAdminPanel();
});

// ── Load everything ──
async function loadAll() {
  await Promise.all([loadStats(), loadBooks(), loadEntries()]);
}

// ── Stats ──
async function loadStats() {
  const [{ count: bookCount }, { count: entryCount }] = await Promise.all([
    db.from('books').select('*', { count: 'exact', head: true }),
    db.from('entries').select('*', { count: 'exact', head: true })
  ]);

  // books with at least one entry
  const { data: activeData } = await db
    .from('entries')
    .select('isbn')
    .limit(1000);

  const activeCount = activeData ? new Set(activeData.map(e => e.isbn)).size : 0;

  document.getElementById('statBooks').textContent = bookCount ?? '—';
  document.getElementById('statEntries').textContent = entryCount ?? '—';
  document.getElementById('statActive').textContent = activeCount;
}

// ── Books ──
async function loadBooks() {
  const { data, error } = await db
    .from('books')
    .select('id, isbn, title, author, cover_url, release_note, released_by, created_at, entries(count)')
    .order('created_at', { ascending: true });

  const container = document.getElementById('booksTableContainer');

  if (error) {
    container.innerHTML = `<p class="empty-state">Failed to load books.</p>`;
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = `<p class="empty-state">No books yet. Add the first one above.</p>`;
    return;
  }

  const rows = data.map(book => {
    const count = book.entries?.[0]?.count ?? 0;
    return `
      <tr id="book-row-${book.id}">
        <td class="td-title">${escapeHtml(book.title)}</td>
        <td class="td-author">${escapeHtml(book.author)}</td>
        <td class="td-isbn">${escapeHtml(book.isbn)}</td>
        <td class="td-count">${count}</td>
        <td class="td-date">${formatDate(book.created_at)}</td>
        <td class="td-actions">
          <button class="btn-action btn-edit" onclick="startEditBook('${book.id}')">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteBook('${book.id}', '${escapeHtml(book.title)}')">Delete</button>
        </td>
      </tr>
    `;
  }).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Title</th>
          <th>Author</th>
          <th>ISBN</th>
          <th style="text-align:center;">Entries</th>
          <th>Added</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;

  // store book data for editing
  window._booksCache = data;
}

function toggleAddBookForm() {
  const form = document.getElementById('addBookForm');
  const isOpen = form.classList.toggle('open');
  if (isOpen) {
    document.getElementById('newIsbn').focus();
  } else {
    clearAddBookForm();
  }
}

function clearAddBookForm() {
  ['newIsbn','newTitle','newAuthor','newCoverUrl','newReleaseNote','newReleasedBy'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('addBookError').textContent = '';
}

async function addBook() {
  const isbn = normalizeISBN(document.getElementById('newIsbn').value.trim());
  const title = document.getElementById('newTitle').value.trim();
  const author = document.getElementById('newAuthor').value.trim();
  const cover_url = document.getElementById('newCoverUrl').value.trim() || null;
  const release_note = document.getElementById('newReleaseNote').value.trim() || null;
  const released_by = document.getElementById('newReleasedBy').value.trim() || null;
  const errorEl = document.getElementById('addBookError');

  if (!isbn || !title || !author) {
    errorEl.textContent = 'ISBN, title, and author are required.';
    return;
  }

  if (!/^\d{13}$/.test(isbn)) {
    errorEl.textContent = 'ISBN must be 13 digits.';
    return;
  }

  errorEl.textContent = '';

  const { error } = await db
    .from('books')
    .insert({ isbn, title, author, cover_url, release_note, released_by });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  toggleAddBookForm();
  await loadAll();
}

function startEditBook(id) {
  const book = window._booksCache?.find(b => b.id === id);
  if (!book) return;

  const row = document.getElementById(`book-row-${id}`);
  row.className = 'edit-row';
  row.innerHTML = `
    <td><input id="edit-title-${id}" value="${escapeHtml(book.title)}" /></td>
    <td><input id="edit-author-${id}" value="${escapeHtml(book.author)}" /></td>
    <td class="td-isbn">${escapeHtml(book.isbn)}</td>
    <td class="td-count">${book.entries?.[0]?.count ?? 0}</td>
    <td>
      <input id="edit-cover-${id}" value="${escapeHtml(book.cover_url || '')}" placeholder="Cover URL" style="font-size:12px;" />
    </td>
    <td class="td-actions">
      <button class="btn-action btn-edit" onclick="saveEditBook('${id}')">Save</button>
      <button class="btn-action btn-delete" onclick="loadBooks()">Cancel</button>
    </td>
  `;
}

async function saveEditBook(id) {
  const title = document.getElementById(`edit-title-${id}`).value.trim();
  const author = document.getElementById(`edit-author-${id}`).value.trim();
  const cover_url = document.getElementById(`edit-cover-${id}`).value.trim() || null;

  if (!title || !author) return;

  const { error } = await db
    .from('books')
    .update({ title, author, cover_url })
    .eq('id', id);

  if (error) {
    alert('Save failed: ' + error.message);
    return;
  }

  await loadBooks();
}

async function deleteBook(id, title) {
  if (!confirm(`Delete "${title}" and all its entries? This cannot be undone.`)) return;

  const { error } = await db.from('books').delete().eq('id', id);

  if (error) {
    alert('Delete failed: ' + error.message);
    return;
  }

  await loadAll();
}

// ── Entries ──
async function loadEntries() {
  const { data, error } = await db
    .from('entries')
    .select('id, found_location, message, found_date, created_at, books(title)')
    .order('created_at', { ascending: false })
    .limit(50);

  const container = document.getElementById('entriesTableContainer');

  if (error) {
    container.innerHTML = `<p class="empty-state">Failed to load entries.</p>`;
    return;
  }

  if (!data || !data.length) {
    container.innerHTML = `<p class="empty-state">No entries yet.</p>`;
    return;
  }

  const rows = data.map(entry => `
    <tr>
      <td class="td-title" style="font-size:15px;">${escapeHtml(entry.books?.title ?? '—')}</td>
      <td class="td-location">${escapeHtml(entry.found_location)}</td>
      <td class="td-message">${escapeHtml(entry.message || '—')}</td>
      <td class="td-date">${formatDate(entry.found_date || entry.created_at)}</td>
      <td class="td-actions">
        <button class="btn-action btn-delete" onclick="deleteEntry('${entry.id}')">Delete</button>
      </td>
    </tr>
  `).join('');

  container.innerHTML = `
    <table class="data-table">
      <thead>
        <tr>
          <th>Book</th>
          <th>Found at</th>
          <th>Message</th>
          <th>Date</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function deleteEntry(id) {
  if (!confirm('Delete this entry? This cannot be undone.')) return;

  const { error } = await db.from('entries').delete().eq('id', id);

  if (error) {
    alert('Delete failed: ' + error.message);
    return;
  }

  await loadAll();
}
