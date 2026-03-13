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

function transformImageUrl(url, width, quality, height) {
  if (!url) return url;
  const transformed = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const h = height ? `&height=${height}` : '';
  return `${transformed}?width=${width}${h}&quality=${quality}&resize=contain`;
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
const entryMarkers = {}; // keyed by sorted entry index → L.circleMarker

// ── Book covers ──
function bookCoverUrl(isbn, storedUrl) {
  if (storedUrl) return storedUrl;
  return `https://covers.openlibrary.org/b/isbn/${isbn}-M.jpg`;
}

// ── Geocoding ──
async function geocodeLocation(loc) {
  if (geocodeCache[loc] !== undefined) {
    console.log(`[map] geocode cache hit: "${loc}" →`, geocodeCache[loc]);
    return geocodeCache[loc];
  }
  console.log(`[map] geocoding: "${loc}"`);
  try {
    const res = await fetch(
      'https://nominatim.openstreetmap.org/search?q=' + encodeURIComponent(loc) + '&format=json&limit=1',
      { headers: { 'Accept-Language': 'en' } }
    );
    const data = await res.json();
    const result = data[0] ? { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) } : null;
    geocodeCache[loc] = result;
    if (result) console.log(`[map] geocode ok: "${loc}" →`, result);
    else console.warn(`[map] geocode no result for: "${loc}"`);
    return result;
  } catch (err) {
    console.error(`[map] geocode failed for "${loc}":`, err);
    geocodeCache[loc] = null;
    return null;
  }
}

function buildArcPath(latlng1, latlng2, segIndex) {
  const p1 = [latlng1.lat, latlng1.lng];
  const p2 = [latlng2.lat, latlng2.lng];
  const dx = p2[0] - p1[0];
  const dy = p2[1] - p1[1];
  const dist = Math.sqrt(dx * dx + dy * dy);
  if (dist < 0.0001) return [p1, p2];

  // Arc control point — alternates sides each segment for visual variety
  const side = segIndex % 2 === 0 ? 1 : -1;
  const arc = dist * 0.18 * side;
  const cx = (p1[0] + p2[0]) / 2 - (dy / dist) * arc;
  const cy = (p1[1] + p2[1]) / 2 + (dx / dist) * arc;

  const steps = 28;
  const wobble = dist * 0.012;
  const pts = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const mt = 1 - t;
    const lat = mt * mt * p1[0] + 2 * mt * t * cx + t * t * p2[0];
    const lng = mt * mt * p1[1] + 2 * mt * t * cy + t * t * p2[1];
    const w = Math.sin(t * 13.1 + segIndex * 7.3) * wobble;
    pts.push([lat + w * (-dy / dist), lng + w * (dx / dist)]);
  }
  return pts;
}

async function renderJourneyMap(entries) {
  const mapEl = document.getElementById('journeyMap');
  if (!mapEl) { console.error('[map] #journeyMap element not found'); return; }
  if (typeof L === 'undefined') { console.error('[map] Leaflet (L) not loaded'); return; }

  const rect = mapEl.getBoundingClientRect();
  console.log(`[map] container size: ${rect.width}×${rect.height}, display: ${getComputedStyle(mapEl).display}`);

  if (journeyMap) { journeyMap.remove(); journeyMap = null; }
  mapEl.style.display = 'block';

  const session = ++geocodeSession;
  console.log(`[map] init session=${session}, entries=${entries.length}`);

  try {
    journeyMap = L.map(mapEl, {
      scrollWheelZoom: false,
      preferCanvas: true,      // single <canvas> for all vectors instead of per-element SVG nodes
      zoomControl: false,      // display-only map, no zoom UI needed
      keyboard: false,         // skip keyboard nav setup
      boxZoom: false,          // skip shift-drag zoom setup
      doubleClickZoom: false,  // skip double-click zoom setup
      fadeAnimation: false,    // tiles appear immediately, no fade-in
      trackResize: false       // modal doesn't resize with the window
    });
    journeyMap.invalidateSize(); // force re-measure in case container was display:none
    console.log('[map] L.map() ok, size after invalidate:', journeyMap.getSize());
  } catch (err) {
    console.error('[map] L.map() threw:', err);
    return;
  }

  L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
    maxZoom: 19,
    updateWhenIdle: true,  // only load tiles when panning stops, not continuously
    keepBuffer: 1          // preload 1 row/col of offscreen tiles instead of default 2
  }).addTo(journeyMap);

  Object.keys(entryMarkers).forEach(k => delete entryMarkers[k]);
  const sorted = [...entries].sort((a, b) => new Date(a.created_at) - new Date(b.created_at));

  // Phase 1: resolve coords — use stored lat/lng where available, geocode the rest
  const resolved = []; // { entryIndex, entry, coords }
  let nominatimDelay = false;
  for (let i = 0; i < sorted.length; i++) {
    if (geocodeSession !== session) { console.log('[map] session cancelled, aborting'); return; }
    const entry = sorted[i];
    if (!entry.found_location) { console.log(`[map] entry ${i} has no location, skipping`); continue; }

    let coords;
    if (entry.lat != null && entry.lng != null) {
      coords = { lat: entry.lat, lng: entry.lng };
      console.log(`[map] using stored coords for entry ${i}: "${entry.found_location}"`);
    } else {
      if (nominatimDelay) await new Promise(r => setTimeout(r, 1100)); // Nominatim rate limit
      if (geocodeSession !== session) { console.log('[map] session cancelled after delay, aborting'); return; }
      coords = await geocodeLocation(entry.found_location);
      nominatimDelay = true;
    }

    if (geocodeSession !== session) return;
    if (!coords) { console.warn(`[map] no coords for entry ${i}: "${entry.found_location}"`); continue; }
    resolved.push({ entryIndex: i, entry, coords });
  }

  // Phase 2: draw path first (so it's behind markers in SVG z-order — no bringToBack needed)
  if (resolved.length > 1) {
    if (!document.getElementById('journey-svg-defs')) {
      const svgDefs = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svgDefs.id = 'journey-svg-defs';
      svgDefs.setAttribute('style', 'position:absolute;width:0;height:0;overflow:hidden');
      svgDefs.innerHTML = `<defs><filter id="journey-roughen" x="-20%" y="-20%" width="140%" height="140%"><feTurbulence type="fractalNoise" baseFrequency="0.035" numOctaves="3" seed="2" result="noise"/><feDisplacementMap in="SourceGraphic" in2="noise" scale="3.5" xChannelSelector="R" yChannelSelector="G"/></filter></defs>`;
      document.body.appendChild(svgDefs);
    }
    const latlngs = resolved.map(r => [r.coords.lat, r.coords.lng]);
    const allPoints = [];
    for (let i = 0; i < latlngs.length - 1; i++) {
      const seg = buildArcPath(L.latLng(latlngs[i]), L.latLng(latlngs[i + 1]), i);
      if (i === 0) allPoints.push(...seg);
      else allPoints.push(...seg.slice(1));
    }
    L.polyline(allPoints, {
      color: '#8b3a2a',
      weight: 2,
      opacity: 0.75,
      dashArray: '5 9',
      className: 'journey-path'
    }).addTo(journeyMap);
    console.log(`[map] path drawn with ${allPoints.length} points`);
  }

  // Phase 3: add markers on top
  const markers = [];
  for (const { entryIndex, entry, coords } of resolved) {
    const marker = L.circleMarker([coords.lat, coords.lng], {
      radius: 7,
      fillColor: '#8b3a2a',
      color: '#f5f0e8',
      weight: 2,
      fillOpacity: 0.85
    }).addTo(journeyMap);
    entryMarkers[entryIndex] = marker;

    const dateStr = entry.found_date ? formatDate(entry.found_date) : formatDate(entry.created_at);
    marker.bindPopup(
      `<span class="map-popup-place">${escapeHtml(entry.found_location)}</span>` +
      `<span class="map-popup-date">${dateStr}</span>`
    );
    markers.push(marker);
  }

  console.log(`[map] placed ${markers.length} marker(s)`);
  if (markers.length > 0) {
    try {
      journeyMap.fitBounds(L.featureGroup(markers).getBounds().pad(0.3));
      console.log('[map] fitBounds ok');
    } catch (err) {
      console.error('[map] fitBounds threw:', err);
    }
  } else {
    console.warn('[map] no markers placed — hiding map');
    mapEl.style.display = 'none';
  }
}

function focusEntryOnMap(index) {
  const marker = entryMarkers[index];
  if (!marker || !journeyMap) return;
  const mapEl = document.getElementById('journeyMap');
  if (mapEl) mapEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
  journeyMap.setView(marker.getLatLng(), 11, { animate: true });
  marker.openPopup();
}

// ── Catalog ──
async function loadAndRenderCatalog() {
  const grid = document.getElementById('bookGrid');

  grid.innerHTML = `<p style="grid-column:1/-1; text-align:center; font-style:italic; color:var(--ink-faint); padding:48px 0;">
    Loading the library…
  </p>`;

  const [booksResult, entriesResult] = await Promise.all([
    supabase.from('books').select('isbn, title, author, cover_url'),
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
      <img class="book-card-cover" src="${bookCoverUrl(book.isbn, book.cover_url)}" alt="" loading="lazy" onerror="this.style.display='none'">
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
    const coverImg = document.getElementById('resultCover');
    const coverPlaceholder = document.getElementById('resultCoverPlaceholder');
    coverImg.src = bookCoverUrl(data.isbn, data.cover_url);
    coverImg.style.display = 'block';
    coverPlaceholder.style.display = 'none';
    const count = data.entries.length;
    document.getElementById('resultStops').textContent =
      count === 0
        ? "No entries yet — you're the first"
        : `${count} ${count === 1 ? 'stop' : 'stops'} along the way`;
    document.getElementById('viewJourneyBtn').style.display = 'block';
    resultEl.classList.add('visible');
  } else {
    currentBook = null;
    document.getElementById('resultTitle').textContent = "Not part of Between Readers";
    document.getElementById('resultAuthor').textContent = "This book doesn't have a sticker registered with us. If you found one on it, double-check the ISBN.";
    document.getElementById('resultStops').textContent = "";
    document.getElementById('viewJourneyBtn').style.display = 'none';
    document.getElementById('resultCover').style.display = 'none';
    document.getElementById('resultCoverPlaceholder').style.display = 'flex';
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
  const modalCover = document.getElementById('modalCover');
  modalCover.src = bookCoverUrl(b.isbn, b.cover_url);
  modalCover.style.display = 'block';

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
            <div class="entry-field">
              <span class="entry-field-label">City</span>
              <span class="entry-location entry-location-link" onclick="focusEntryOnMap(${i})" title="Show on map">${escapeHtml(entry.found_location)}</span>
            </div>
            <div class="entry-field">
              <span class="entry-field-label">Date</span>
              <span class="entry-date">${formatDate(entry.found_date || entry.created_at)}</span>
            </div>
          </div>
          ${entry.location_description ? `<div class="entry-field"><span class="entry-field-label">Spot / Hiding Place</span><p class="entry-location-desc">${escapeHtml(entry.location_description)}</p></div>` : ''}
          ${entry.message ? `<div class="entry-field"><span class="entry-field-label">Comment / Story</span><p class="entry-message">${escapeHtml(entry.message)}</p></div>` : ''}
          ${entry.photo_url ? `<img class="entry-photo" src="${escapeHtml(transformImageUrl(entry.photo_url, 800, 75, 400))}" alt="" loading="lazy" onclick="openPhotoModal('${escapeHtml(transformImageUrl(entry.photo_url, 1600, 85))}')" >` : ''}
        </div>
      </div>
    `).join('');
  }

  const mapEl = document.getElementById('journeyMap');
  if (mapEl) mapEl.style.display = entries.length > 0 ? 'block' : 'none';

  resetEntryForm();

  document.getElementById('modalOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';

  if (entries.length > 0) {
    // Defer map init until after the modal is visible so Leaflet can measure dimensions
    requestAnimationFrame(() => renderJourneyMap(entries));
  }
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
      <div class="photo-upload" id="photoUploadBox" onclick="this.querySelector('input').click()">
        <p class="photo-upload-text" id="photoUploadText">📷 &nbsp; Tap to add a photo</p>
        <input type="file" accept="image/*" style="display:none" id="photoFileInput" />
      </div>
    </div>
    <p id="entryError" style="color:var(--rust); font-style:italic; font-size:14px; min-height:20px; margin-top:4px;"></p>
    <button class="submit-entry-btn" id="submitEntryBtn" onclick="submitEntry()">Leave Your Mark</button>
  `;
  initLocationAutocomplete();

  // Show filename when photo is selected
  const fileInput = document.getElementById('photoFileInput');
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const file = fileInput.files[0];
      const label = document.getElementById('photoUploadText');
      if (file && label) label.textContent = '✓ ' + file.name;
    });
  }
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

// ── Passcode modal ──
function openPasscodeModal() {
  if (!currentBook) return;
  // If no passcode is set on this book, open the journey directly
  if (!currentBook.passcode) {
    openModal();
    return;
  }
  document.getElementById('passcodeBookTitle').textContent = currentBook.title;
  document.getElementById('passcodeInput').value = '';
  document.getElementById('passcodeError').textContent = '';
  document.getElementById('passcodeOverlay').classList.add('open');
  document.body.style.overflow = 'hidden';
  setTimeout(() => document.getElementById('passcodeInput').focus(), 50);
}

function closePasscodeModal() {
  document.getElementById('passcodeOverlay').classList.remove('open');
  document.body.style.overflow = '';
}

function handlePasscodeOverlayClick(e) {
  if (e.target === document.getElementById('passcodeOverlay')) closePasscodeModal();
}

function verifyPasscode() {
  const input = document.getElementById('passcodeInput').value.trim();
  const errorEl = document.getElementById('passcodeError');

  if (!input) {
    errorEl.textContent = 'Please enter the passcode.';
    return;
  }

  if (input !== String(currentBook.passcode)) {
    errorEl.textContent = 'Incorrect passcode. Check the inside cover of the book.';
    document.getElementById('passcodeInput').select();
    return;
  }

  closePasscodeModal();
  openModal();
}

// Helper called by scanner.js when a scanned ISBN is not in the database
function showNotFoundResult() {
  document.getElementById('resultTitle').textContent = "Not part of Between Readers";
  document.getElementById('resultAuthor').textContent = "This book doesn't have a sticker registered with us. If you found one on it, double-check the ISBN.";
  document.getElementById('resultStops').textContent = '';
  document.getElementById('viewJourneyBtn').style.display = 'none';
  document.getElementById('resultCover').style.display = 'none';
  document.getElementById('resultCoverPlaceholder').style.display = 'flex';
  document.getElementById('bookResult').classList.add('visible');
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

function openPhotoModal(url) {
  const lightbox = document.getElementById('photoLightbox');
  document.getElementById('photoLightboxImg').src = url;
  lightbox.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closePhotoModal() {
  document.getElementById('photoLightbox').classList.remove('open');
  document.body.style.overflow = '';
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

  // Upload photo if one was selected
  let photo_url = null;
  const fileInput = document.getElementById('photoFileInput');
  const file = fileInput?.files?.[0] || null;
  if (file) {
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const path = `${currentBook.isbn}/${Date.now()}.${ext}`;
    if (typeof debugLog === 'function') debugLog(`photo: uploading ${file.name} (${Math.round(file.size/1024)}KB) → ${path}`);
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('entry-photos')
      .upload(path, file, { contentType: file.type });
    if (uploadError) {
      if (typeof debugLog === 'function') debugLog('photo upload failed: ' + uploadError.message + ' (code: ' + (uploadError.statusCode || '?') + ')', 'error');
    } else {
      const { data: urlData } = supabase.storage.from('entry-photos').getPublicUrl(path);
      photo_url = urlData.publicUrl;
      if (typeof debugLog === 'function') debugLog('photo upload ok → ' + photo_url);
    }
  } else {
    if (typeof debugLog === 'function') debugLog('photo: no file selected');
  }

  // Geocode location at submission time so the map loads instantly on future views
  const coords = await geocodeLocation(locationPlace);
  if (typeof debugLog === 'function') debugLog(`entry insert: photo_url=${photo_url ? 'set' : 'null'}, coords=${coords ? `${coords.lat},${coords.lng}` : 'null'}`);
  const { error } = await supabase
    .from('entries')
    .insert({
      isbn: currentBook.isbn,
      found_location: locationPlace,
      location_description: locationDesc || null,
      message: message || null,
      photo_url,
      found_date: foundAt,
      lat: coords?.lat ?? null,
      lng: coords?.lng ?? null
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

// Enter key on passcode input
document.getElementById('passcodeInput').addEventListener('keydown', e => {
  if (e.key === 'Enter') verifyPasscode();
});

// ── Init ──
loadAndRenderCatalog();
