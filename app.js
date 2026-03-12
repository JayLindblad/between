// ── Supabase client ──
// SUPABASE_URL and SUPABASE_ANON_KEY are defined in config.js.
// If config.js already called createClient(), use that instance.
// Otherwise create it here. We avoid re-declaring 'supabase' with const/let
// because that throws "already declared" when config.js does it first.
if (!window._supabaseClient) {
  if (typeof SUPABASE_URL === 'undefined' || typeof SUPABASE_ANON_KEY === 'undefined') {
    if (typeof debugLog === 'function') debugLog('FATAL: config.js missing or secrets not set', 'error');
    throw new Error('Between Readers: SUPABASE_URL/KEY not defined. Check config.js or GitHub secrets.');
  }
  window._supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}
var supabase = window._supabaseClient;
// From here, bare 'supabase' resolves to the initialized client in both cases.

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
let journeyMap = null;
let geocodeSession = 0;
const geocodeCache = {};
let autocompleteTimeout = null;
let autocompleteActive = -1;

// ── Geocoding ──
async function geocodeLocation(loc) {
  if (geocodeCache[loc] !== undefined) return geocodeCache[loc];
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(loc) + '&format=json&limit=1',
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const result = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    geocodeCache[loc] = result;
    return result;
  } catch {
    geocodeCache[loc] = null;
    return null;
  }
}

async function renderJourneyMap(entries) {
  const mapEl = document.getElementById('journeyMap');
  if (!mapEl || typeof L === 'undefined') return;

  if (journeyMap) { journeyMap.remove(); journeyMap = null; }
  mapEl.style.display = 'block';

  const session = ++geocodeSession;
  journeyMap = L.map(mapEl, { scrollWheelZoom: false });
  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19
  }).addTo(journeyMap);

  const sorted = [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
  const markers = [];

  for (let i = 0; i < sorted.length; i++) {
    if (geocodeSession !== session) return;
    const entry = sorted[i];
    if (!entry.found_location) continue;
    if (i > 0) await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
    if (geocodeSession !== session) return;

    const coords = await geocodeLocation(entry.found_location);
    if (geocodeSession !== session) return;
    if (!coords) continue;

    const marker = L.circleMarker([coords.lat, coords.lng], {
      radius: 7,
      fillColor: '#8b3a2a',
      color: '#f5f0e8',
      weight: 2,
      fillOpacity: 0.85
    }).addTo(journeyMap);

    const dateStr = entry.found_date ? formatDate(entry.found_date) : formatDate(entry.created_at);
    marker.bindPopup(
      `<strong>${escapeHtml(entry.found_location)}</strong>` +
      (entry.location_description ? `<br><em>${escapeHtml(entry.location_description)}</em>` : '') +
      `<br><em>${dateStr}</em>` +
      (entry.message ? `<br>${escapeHtml(entry.message)}` : '')
    );
    markers.push(marker);
  }

  if (markers.length > 0) {
    journeyMap.fitBounds(L.featureGroup(markers).getBounds().pad(0.3));
  } else {
    mapEl.style.display = 'none';
  }
}

// ── Catalog ──
async function loadAndRenderCatalog() {
  const grid = document.getElementById('bookGrid');

  grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; font-style:italic; color:var(--ink-faint); padding:48px 0;">
    Loading the library…
  </p>`;

  const [booksResult, entriesResult] = await Promise.all([
    supabase.from('books').select('isbn, title, author'),
    supabase.from('entries').select('isbn')
  ]);

  if (booksResult.error) {
    if (typeof debugLog === 'function') debugLog('catalog load error: ' + (booksResult.error.message || JSON.stringify(booksResult.error)), 'error');
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; color:var(--rust); padding:48px 0; font-style:italic;">
      Could not load the library. Please refresh.
    </p>`;
    return;
  }

  const countMap = {};
  (entriesResult.data || []).forEach(e => {
    countMap[e.isbn] = (countMap[e.isbn] || 0) + 1;
  });

  books = booksResult.data.map(b => ({
    ...b,
    entryCount: countMap[b.isbn] || 0
  }));

  if (!books.length) {
    grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; font-style:italic; color:var(--ink-faint); padding:48px 0;">
      No books in the library yet.
    </p>`;
    return;
  }

  grid.innerHTML = books.map((book, i) => `
    <div class="book-card" onclick="openBookDirect('${book.isbn}')">
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
async function lookupISBN(isbnDirect) {
  const isbn = isbnDirect
    ? normalizeISBN(isbnDirect)
    : normalizeISBN(document.getElementById('isbnInput').value.trim());
  if (!isbn) return;

  // When called directly (e.g. from scanner), skip search-field UI entirely
  if (isbnDirect) {
    const { data, error } = await supabase
      .from('books')
      .select('*, entries(*)')
      .eq('isbn', isbn)
      .maybeSingle();
    currentBook = (!error && data) ? data : null;
    return;
  }

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
async function openBookDirect(bookIsbn) {
  const entered = prompt("Enter the ISBN from the back of the book to read its journey:");
  if (!entered) return;

  if (normalizeISBN(entered) !== normalizeISBN(bookIsbn)) {
    alert("That ISBN doesn't match this book.");
    return;
  }

  const { data, error } = await supabase
    .from('books')
    .select('*, entries(*)')
    .eq('isbn', bookIsbn)
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
            <span class="entry-location">${escapeHtml(entry.found_location)}</span>
            <span class="entry-date">${formatDate(entry.found_date || entry.created_at)}</span>
          </div>
          ${entry.location_description ? `<p class="entry-location-desc">${escapeHtml(entry.location_description)}</p>` : ''}
          <p class="entry-message">${escapeHtml(entry.message || '')}</p>
        </div>
      </div>
    `).join('');
  }

  const mapEl = document.getElementById('journeyMap');
  if (entries.length > 0) {
    renderJourneyMap(entries);
  } else if (mapEl) {
    mapEl.style.display = 'none';
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
      <label class="form-label">City</label>
      <div class="location-autocomplete-wrapper">
        <input class="form-input" id="entryLocationPlace" type="text" placeholder="Portland, OR · New York, NY" autocomplete="off" />
      </div>
    </div>
    <div class="form-field">
      <label class="form-label">The exact spot <span style="font-style:italic; text-transform:none; letter-spacing:0;">(optional)</span></label>
      <input class="form-input" id="entryLocationDesc" type="text" placeholder="On a park bench, tucked behind the coffee shop shelf…" />
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
  initLocationAutocomplete();
}

// ── Location autocomplete ──
function initLocationAutocomplete() {
  const input = document.getElementById('entryLocationPlace');
  if (!input) return;

  const wrapper = input.closest('.location-autocomplete-wrapper');
  const suggestions = document.createElement('ul');
  suggestions.className = 'location-suggestions';
  wrapper.appendChild(suggestions);

  input.addEventListener('input', () => {
    clearTimeout(autocompleteTimeout);
    autocompleteActive = -1;
    const q = input.value.trim();
    if (q.length < 2) {
      suggestions.innerHTML = '';
      suggestions.classList.remove('open');
      return;
    }
    autocompleteTimeout = setTimeout(() => fetchLocationSuggestions(q, suggestions, input), 350);
  });

  input.addEventListener('keydown', (e) => {
    const items = suggestions.querySelectorAll('.location-suggestion-item');
    if (!items.length) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      autocompleteActive = Math.min(autocompleteActive + 1, items.length - 1);
      updateActiveSuggestion(items);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      autocompleteActive = Math.max(autocompleteActive - 1, -1);
      updateActiveSuggestion(items);
    } else if (e.key === 'Enter' && autocompleteActive >= 0) {
      e.preventDefault();
      items[autocompleteActive].click();
    } else if (e.key === 'Escape') {
      suggestions.innerHTML = '';
      suggestions.classList.remove('open');
      autocompleteActive = -1;
    }
  });

  input.addEventListener('blur', () => {
    setTimeout(() => {
      suggestions.innerHTML = '';
      suggestions.classList.remove('open');
      autocompleteActive = -1;
    }, 200);
  });
}

async function fetchLocationSuggestions(query, listEl, input) {
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(query) +
      '&format=json&limit=5&addressdetails=1',
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    autocompleteActive = -1;
    listEl.innerHTML = '';
    if (!data.length) { listEl.classList.remove('open'); return; }

    data.forEach(place => {
      const li = document.createElement('li');
      li.className = 'location-suggestion-item';
      const name = formatPlaceName(place);
      li.textContent = name;
      li.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent input blur before click fires
        input.value = name;
        listEl.innerHTML = '';
        listEl.classList.remove('open');
        autocompleteActive = -1;
      });
      listEl.appendChild(li);
    });
    listEl.classList.add('open');
  } catch {
    listEl.classList.remove('open');
  }
}

function formatPlaceName(place) {
  const a = place.address || {};
  const city = a.city || a.town || a.village || a.hamlet || a.suburb;
  const parts = [];
  // Include the POI/business name if Nominatim has one (e.g. "Powell's Books", "Central Park")
  if (place.name && place.name !== city) parts.push(place.name);
  if (city) parts.push(city);
  if (a.state) parts.push(a.state);
  if (a.country) parts.push(a.country);
  return parts.length ? parts.join(', ') : place.display_name.split(',').slice(0, 3).join(',').trim();
}

function updateActiveSuggestion(items) {
  items.forEach((item, i) => item.classList.toggle('active', i === autocompleteActive));
}

function closeModal() {
  geocodeSession++; // cancel any in-progress geocoding
  if (journeyMap) { journeyMap.remove(); journeyMap = null; }
  const mapEl = document.getElementById('journeyMap');
  if (mapEl) mapEl.style.display = 'none';
  document.getElementById('modalOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handleOverlayClick(e) {
  if (e.target === document.getElementById('modalOverlay')) closeModal();
}

// ── Submit entry ──
async function submitEntry() {
  if (!currentBook) return;

  const locationPlace = document.getElementById('entryLocationPlace').value.trim();
  const locationDesc = document.getElementById('entryLocationDesc').value.trim();
  const message = document.getElementById('entryMessage').value.trim();
  const foundAt = document.getElementById('entryDate').value || null;
  const errorEl = document.getElementById('entryError');
  const btn = document.getElementById('submitEntryBtn');

  if (!locationPlace) {
    errorEl.textContent = 'Please enter a city or place name for the map.';
    document.getElementById('entryLocationPlace').focus();
    return;
  }

  errorEl.textContent = '';
  btn.textContent = 'Leaving your mark…';
  btn.disabled = true;

  const { error } = await supabase
    .from('entries')
    .insert({
      isbn: currentBook.isbn,
      found_location: locationPlace,
      location_description: locationDesc || null,
      message: message || null,
      found_date: foundAt
    });

  if (error) {
    btn.textContent = 'Leave Your Mark';
    btn.disabled = false;
    if (typeof debugLog === 'function') debugLog('entry insert error: ' + (error.message || error.code || JSON.stringify(error)), 'error');
    errorEl.textContent = 'Something went wrong: ' + (error.message || error.code || 'unknown error');
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
