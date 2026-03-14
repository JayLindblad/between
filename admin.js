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

// ── ISBN metadata auto-fill ──
async function autoFillIsbn() {
  const isbn = normalizeISBN(document.getElementById('newIsbn').value.trim());
  const statusEl = document.getElementById('isbnLookupStatus');

  if (!/^\d{13}$/.test(isbn)) {
    statusEl.textContent = '';
    return;
  }

  statusEl.style.color = 'var(--ink-faint)';
  statusEl.textContent = 'Looking up…';

  // ── Open Library ──
  try {
    const res = await fetch(
      `https://openlibrary.org/api/books?bibkeys=ISBN:${isbn}&format=json&jscmd=data`
    );
    const data = await res.json();
    const book = data[`ISBN:${isbn}`];

    if (book) {
      if (book.title) document.getElementById('newTitle').value = book.title;
      if (book.authors?.length)
        document.getElementById('newAuthor').value = book.authors.map(a => a.name).join(', ');
      const cover = book.cover?.large || book.cover?.medium || book.cover?.small || '';
      if (cover) document.getElementById('newCoverUrl').value = cover;
      statusEl.style.color = 'var(--gold)';
      statusEl.textContent = '✓ Filled from Open Library';
      return;
    }
  } catch (_) { /* fall through */ }

  // ── Google Books fallback ──
  try {
    const res = await fetch(
      `https://www.googleapis.com/books/v1/volumes?q=isbn:${isbn}`
    );
    const data = await res.json();
    const vol = data.items?.[0]?.volumeInfo;

    if (vol) {
      if (vol.title) document.getElementById('newTitle').value = vol.title;
      if (vol.authors?.length)
        document.getElementById('newAuthor').value = vol.authors.join(', ');
      if (vol.imageLinks?.thumbnail)
        document.getElementById('newCoverUrl').value =
          vol.imageLinks.thumbnail.replace('http://', 'https://').replace('&zoom=1', '&zoom=0');
      statusEl.style.color = 'var(--gold)';
      statusEl.textContent = '✓ Filled from Google Books';
      return;
    }
  } catch (_) { /* fall through */ }

  statusEl.style.color = 'var(--ink-faint)';
  statusEl.textContent = 'Not found in public databases — enter details manually';
}

// ── Admin barcode scanner ──
let adminScannerActive = false;
let adminVideoStream = null;
let adminScanInterval = null;
let adminZxingReady = false;
let adminReadBarcodesFn = null;

async function initAdminZXing() {
  if (adminZxingReady) return true;
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://fastly.jsdelivr.net/npm/zxing-wasm@2.2.4/dist/iife/reader/index.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });
    await ZXingWASM.prepareZXingModule({ fireImmediately: true });
    adminReadBarcodesFn = ZXingWASM.readBarcodes;
    adminZxingReady = true;
    return true;
  } catch (e) {
    if (typeof debugLog === 'function') debugLog('ZXing load error: ' + e, 'error');
    return false;
  }
}

async function openAdminCamera() {
  const overlay = document.getElementById('adminCameraOverlay');
  const status = document.getElementById('adminCameraStatus');
  const video = document.getElementById('adminCameraVideo');

  overlay.classList.add('open');
  status.className = '';
  status.textContent = 'Starting camera…';

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    status.className = 'error';
    status.textContent = 'Camera not available — type the ISBN manually';
    return;
  }

  try {
    const [stream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      }),
      initAdminZXing()
    ]);

    adminVideoStream = stream;
    video.srcObject = stream;
    await video.play();

    if (!adminZxingReady) {
      status.className = 'error';
      status.textContent = 'Scanner unavailable — type the ISBN manually';
      return;
    }

    status.textContent = 'Align barcode within the frame';
    adminScannerActive = true;
    startAdminScanLoop(video);

  } catch (err) {
    const denied = err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError';
    const noCamera = err.name === 'NotFoundError' || err.name === 'DevicesNotFoundError';
    status.className = 'error';
    if (noCamera) { closeAdminCamera(); }
    else status.textContent = denied ? 'Camera permission denied' : 'Camera unavailable — type the ISBN manually';
  }
}

function startAdminScanLoop(video) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  adminScanInterval = setInterval(async () => {
    if (!adminScannerActive || !adminZxingReady || video.readyState < 2 || !adminReadBarcodesFn) return;
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) return;
      const results = await adminReadBarcodesFn(blob, {
        tryHarder: true,
        formats: ['EAN-13', 'EAN-8'],
        maxNumberOfSymbols: 1
      });
      if (results && results.length > 0) {
        const clean = results[0].text.replace(/\D/g, '');
        if (clean.length === 13 && (clean.startsWith('978') || clean.startsWith('979'))) {
          onAdminBarcodeDetected(clean);
        }
      }
    } catch (_) {}
  }, 300);
}

function onAdminBarcodeDetected(isbn) {
  adminScannerActive = false;
  const status = document.getElementById('adminCameraStatus');
  status.className = 'success';
  status.textContent = 'Found: ' + isbn;

  const reticle = document.querySelector('#adminCameraOverlay .reticle-inner');
  if (reticle) {
    reticle.style.outline = '2px solid var(--gold-light)';
    reticle.style.boxShadow = '0 0 24px rgba(212, 168, 67, 0.5)';
  }

  setTimeout(() => {
    closeAdminCamera();
    document.getElementById('newIsbn').value = isbn;
    autoFillIsbn();
  }, 700);
}

function closeAdminCamera() {
  adminScannerActive = false;
  clearInterval(adminScanInterval);
  adminScanInterval = null;

  if (adminVideoStream) {
    adminVideoStream.getTracks().forEach(t => t.stop());
    adminVideoStream = null;
  }

  const video = document.getElementById('adminCameraVideo');
  if (video) video.srcObject = null;

  document.getElementById('adminCameraOverlay').classList.remove('open');

  const reticle = document.querySelector('#adminCameraOverlay .reticle-inner');
  if (reticle) { reticle.style.outline = ''; reticle.style.boxShadow = ''; }
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
  await Promise.all([loadStats(), loadBooks(), loadEntries(), loadSubmissions()]);
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
  const [booksResult, entriesResult] = await Promise.all([
    db.from('books').select('isbn, release_note, released_by, passcode, isbn_metadata(title, author, cover_url, description)'),
    db.from('entries').select('isbn')
  ]);

  const container = document.getElementById('booksTableContainer');

  if (booksResult.error) {
    const msg = booksResult.error.message || booksResult.error.code || JSON.stringify(booksResult.error);
    if (typeof debugLog === 'function') debugLog('loadBooks error: ' + msg, 'error');
    container.innerHTML = `<p class="empty-state">Failed to load books: ${msg}</p>`;
    return;
  }

  // Flatten isbn_metadata join into each book object
  const data = (booksResult.data || []).map(b => ({
    isbn:         b.isbn,
    title:        b.isbn_metadata?.title,
    author:       b.isbn_metadata?.author,
    cover_url:    b.isbn_metadata?.cover_url,
    description:  b.isbn_metadata?.description,
    passcode:     b.passcode,
    release_note: b.release_note,
    released_by:  b.released_by
  }));

  if (!data.length) {
    container.innerHTML = `<p class="empty-state">No books yet. Add the first one above.</p>`;
    return;
  }

  const countMap = {};
  (entriesResult.data || []).forEach(e => {
    countMap[e.isbn] = (countMap[e.isbn] || 0) + 1;
  });

  const rows = data.map(book => {
    const count = countMap[book.isbn] || 0;
    const safeIsbn = escapeHtml(book.isbn);
    return `
      <tr id="book-row-${safeIsbn}">
        <td class="td-title" data-label="Title">${escapeHtml(book.title)}</td>
        <td class="td-author" data-label="Author">${escapeHtml(book.author)}</td>
        <td class="td-isbn" data-label="ISBN">${safeIsbn}</td>
        <td class="td-isbn" data-label="Passcode" style="text-align:center;">${escapeHtml(book.passcode || '—')}</td>
        <td class="td-count" data-label="Entries">${count}</td>
        <td class="td-message" data-label="Description" style="max-width:220px; font-style:${book.description ? 'normal' : 'italic'}; color:${book.description ? 'inherit' : 'var(--ink-faint)'};">${book.description ? escapeHtml(book.description.length > 120 ? book.description.slice(0, 120) + '…' : book.description) : 'none'}</td>
        <td class="td-actions">
          <button class="btn-action btn-edit" onclick="startEditBook('${safeIsbn}')">Edit</button>
          <button class="btn-action btn-delete" onclick="deleteBook('${safeIsbn}', '${escapeHtml(book.title)}')">Delete</button>
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
          <th style="text-align:center;">Passcode</th>
          <th style="text-align:center;">Entries</th>
          <th>Description</th>
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
  ['newIsbn','newTitle','newAuthor','newCoverUrl','newReleaseNote','newReleasedBy','newPasscode'].forEach(id => {
    document.getElementById(id).value = '';
  });
  document.getElementById('addBookError').textContent = '';
  document.getElementById('isbnLookupStatus').textContent = '';
}

async function addBook() {
  const isbn = normalizeISBN(document.getElementById('newIsbn').value.trim());
  const title = document.getElementById('newTitle').value.trim();
  const author = document.getElementById('newAuthor').value.trim();
  const cover_url = document.getElementById('newCoverUrl').value.trim() || null;
  const release_note = document.getElementById('newReleaseNote').value.trim() || null;
  const released_by = document.getElementById('newReleasedBy').value.trim() || null;
  const passcode = document.getElementById('newPasscode').value.trim() || null;
  const errorEl = document.getElementById('addBookError');

  if (!isbn || !title || !author) {
    errorEl.textContent = 'ISBN, title, and author are required.';
    return;
  }

  if (!/^\d{13}$/.test(isbn)) {
    errorEl.textContent = 'ISBN must be 13 digits.';
    return;
  }

  if (passcode && !/^\d{1,6}$/.test(passcode)) {
    errorEl.textContent = 'Passcode must be up to 6 digits.';
    return;
  }

  errorEl.textContent = '';

  // Ensure isbn_metadata exists (may already be there from a prior scan)
  const { error: metaError } = await db
    .from('isbn_metadata')
    .upsert({ isbn, title, author, cover_url }, { onConflict: 'isbn', ignoreDuplicates: false });

  if (metaError) {
    errorEl.textContent = 'Metadata error: ' + metaError.message;
    return;
  }

  // Insert the thin books row (metadata lives in isbn_metadata)
  const { error } = await db
    .from('books')
    .insert({ isbn, release_note, released_by, passcode });

  if (error) {
    errorEl.textContent = error.message;
    return;
  }

  toggleAddBookForm();
  await loadAll();
}

function startEditBook(isbn) {
  const book = window._booksCache?.find(b => b.isbn === isbn);
  if (!book) return;

  const safeIsbn = escapeHtml(isbn);
  const row = document.getElementById(`book-row-${safeIsbn}`);
  row.className = 'edit-row';
  row.innerHTML = `
    <td data-label="Title"><input id="edit-title-${safeIsbn}" value="${escapeHtml(book.title)}" /></td>
    <td data-label="Author"><input id="edit-author-${safeIsbn}" value="${escapeHtml(book.author)}" /></td>
    <td class="td-isbn" data-label="ISBN">${safeIsbn}</td>
    <td data-label="Passcode">
      <input id="edit-passcode-${safeIsbn}" value="${escapeHtml(book.passcode || '')}" placeholder="6 digits" maxlength="6" inputmode="numeric" style="text-align:center; font-size:14px; letter-spacing:0.15em; width:80px;" />
    </td>
    <td data-label="Cover URL">
      <input id="edit-cover-${safeIsbn}" value="${escapeHtml(book.cover_url || '')}" placeholder="Cover URL" style="font-size:12px;" />
    </td>
    <td data-label="Description" style="min-width:200px;">
      <textarea id="edit-description-${safeIsbn}" placeholder="Auto-fetched — clear to re-fetch" rows="3" style="width:100%; font-size:12px; resize:vertical;">${escapeHtml(book.description || '')}</textarea>
    </td>
    <td class="td-actions">
      <button class="btn-action btn-edit" onclick="saveEditBook('${safeIsbn}')">Save</button>
      <button class="btn-action btn-delete" onclick="loadBooks()">Cancel</button>
    </td>
  `;
}

async function saveEditBook(isbn) {
  const safeIsbn = escapeHtml(isbn);
  const title = document.getElementById(`edit-title-${safeIsbn}`).value.trim();
  const author = document.getElementById(`edit-author-${safeIsbn}`).value.trim();
  const cover_url = document.getElementById(`edit-cover-${safeIsbn}`).value.trim() || null;
  const passcode = document.getElementById(`edit-passcode-${safeIsbn}`).value.trim() || null;
  const description = document.getElementById(`edit-description-${safeIsbn}`).value.trim() || null;

  if (!title || !author) return;

  // Metadata lives in isbn_metadata; book-specific fields stay in books
  const [{ error: metaError }, { error: bookError }] = await Promise.all([
    db.from('isbn_metadata').update({ title, author, cover_url, description }).eq('isbn', isbn),
    db.from('books').update({ passcode }).eq('isbn', isbn)
  ]);

  if (metaError || bookError) {
    alert('Save failed: ' + (metaError?.message || bookError?.message));
    return;
  }

  await loadBooks();
}

async function deleteBook(isbn, title) {
  if (!confirm(`Delete "${title}" and all its entries? This cannot be undone.`)) return;

  const { error } = await db.from('books').delete().eq('isbn', isbn);

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
    .select('id, finder_name, found_location, location_description, message, found_date, created_at, photo_url, books(isbn_metadata(title))')
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
      <td class="td-title" data-label="Book" style="font-size:15px;">${escapeHtml(entry.books?.isbn_metadata?.title ?? '—')}</td>
      <td class="td-author" data-label="Name">${escapeHtml(entry.finder_name || '—')}</td>
      <td class="td-location" data-label="Found at">
        ${escapeHtml(entry.found_location)}
        ${entry.location_description ? `<div style="font-size:12px; font-style:italic; color:var(--ink-faint); margin-top:2px;">${escapeHtml(entry.location_description)}</div>` : ''}
      </td>
      <td class="td-message" data-label="Message">${escapeHtml(entry.message || '—')}</td>
      <td class="td-date" data-label="Date">${formatDate(entry.found_date || entry.created_at)}</td>
      <td data-label="Photo" style="text-align:center;">
        ${entry.photo_url ? `<a href="${escapeHtml(entry.photo_url)}" target="_blank" rel="noopener"><img src="${escapeHtml(entry.photo_url)}" alt="" style="height:48px; width:48px; object-fit:cover; border:1px solid var(--border); display:block;" loading="lazy" /></a>` : '<span style="color:var(--ink-faint); font-style:italic; font-size:13px;">—</span>'}
      </td>
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
          <th>Name</th>
          <th>Found at</th>
          <th>Message</th>
          <th>Date</th>
          <th style="text-align:center;">Photo</th>
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

// ── Submissions ──
async function loadSubmissions() {
  const { data, error } = await db
    .from('book_submissions')
    .select('*')
    .order('created_at', { ascending: false });

  const container = document.getElementById('submissionsTableContainer');
  const countEl = document.getElementById('submissionsCount');

  if (error) {
    container.innerHTML = `<p class="empty-state">Failed to load submissions.</p>`;
    return;
  }

  if (!data || !data.length) {
    countEl.textContent = '';
    container.innerHTML = `<p class="empty-state">No pending submissions.</p>`;
    return;
  }

  // Fetch metadata for all submission ISBNs from the cache table
  const isbns = [...new Set(data.map(s => s.isbn))];
  let metaMap = {};
  if (isbns.length) {
    const { data: metaData } = await db.from('isbn_metadata').select('isbn, title, author').in('isbn', isbns);
    metaMap = Object.fromEntries((metaData || []).map(m => [m.isbn, m]));
  }

  countEl.textContent = `(${data.length})`;

  const rows = data.map(sub => {
    const meta = metaMap[sub.isbn] || {};
    return `
      <tr>
        <td class="td-title" data-label="Title">${escapeHtml(meta.title || '—')}</td>
        <td class="td-author" data-label="Author">${escapeHtml(meta.author || '—')}</td>
        <td class="td-isbn" data-label="ISBN">${escapeHtml(sub.isbn)}</td>
        <td class="td-isbn" data-label="Passcode" style="text-align:center; letter-spacing:0.15em;">${escapeHtml(sub.passcode)}</td>
        <td class="td-author" data-label="Released by">${escapeHtml(sub.released_by || '—')}</td>
        <td class="td-message" data-label="Note">${escapeHtml(sub.release_note || '—')}</td>
        <td class="td-date" data-label="Submitted">${formatDate(sub.created_at)}</td>
        <td class="td-actions">
          <button class="btn-action btn-edit" onclick="approveSubmission('${sub.id}')">Approve</button>
          <button class="btn-action btn-delete" onclick="declineSubmission('${sub.id}')">Decline</button>
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
          <th style="text-align:center;">Passcode</th>
          <th>Released by</th>
          <th>Note</th>
          <th>Submitted</th>
          <th></th>
        </tr>
      </thead>
      <tbody>${rows}</tbody>
    </table>
  `;
}

async function approveSubmission(id) {
  const { data: sub, error: fetchError } = await db
    .from('book_submissions')
    .select('*')
    .eq('id', id)
    .single();

  if (fetchError || !sub) {
    alert('Could not load submission.');
    return;
  }

  // Metadata is already in isbn_metadata (populated at scan/lookup time).
  // Just insert the thin books row.
  const { error } = await db.from('books').insert({
    isbn:         sub.isbn,
    passcode:     sub.passcode,
    release_note: sub.release_note || null,
    released_by:  sub.released_by || null
  });

  if (error) {
    alert('Failed to add book: ' + error.message);
    return;
  }

  await db.from('book_submissions').delete().eq('id', id);
  await loadAll();
}

async function declineSubmission(id) {
  if (!confirm('Decline and remove this submission?')) return;
  await db.from('book_submissions').delete().eq('id', id);
  await loadSubmissions();
}
