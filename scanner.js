// ── ZXing Barcode Scanner ──

let scannerActive = false;
let videoStream = null;
let scanInterval = null;
let zxingReady = false;
let readBarcodesFn = null;

async function initZXing() {
  if (zxingReady) return true;
  try {
    await new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = 'https://fastly.jsdelivr.net/npm/zxing-wasm@2.2.4/dist/iife/reader/index.js';
      s.onload = resolve;
      s.onerror = reject;
      document.head.appendChild(s);
    });

    // The IIFE default locateFile already points at jsDelivr CDN for the .wasm file.
    // Use fireImmediately to await full WASM instantiation before scanning starts.
    await ZXingWASM.prepareZXingModule({ fireImmediately: true });

    readBarcodesFn = ZXingWASM.readBarcodes;
    zxingReady = true;
    return true;
  } catch(e) {
    console.error('ZXing load error:', e);
    return false;
  }
}

async function openCamera() {
  debugLog('openCamera() called');
  const overlay = document.getElementById('cameraOverlay');
  const status = document.getElementById('cameraStatus');
  const video = document.getElementById('cameraVideo');

  overlay.classList.add('open');
  status.className = 'camera-status';
  status.textContent = 'Starting camera…';
  debugLog('overlay opened');

  try {
    debugLog('requesting camera + loading ZXing…');
    // Start camera and ZXing WASM load in parallel
    const [stream] = await Promise.all([
      navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } }
      }),
      initZXing()
    ]);

    debugLog('camera stream acquired, zxingReady=' + zxingReady);
    videoStream = stream;
    video.srcObject = stream;
    await video.play();

    if (!zxingReady) {
      debugLog('ZXing not ready', 'warn');
      status.className = 'camera-status error';
      status.textContent = 'Scanner unavailable — please type the ISBN below';
      return;
    }

    debugLog('scan loop starting');
    status.textContent = 'Align barcode within the frame';
    scannerActive = true;
    startScanLoop(video);

  } catch(err) {
    debugLog('Camera error: ' + err.name + ' – ' + err.message, 'error');
    status.className = 'camera-status error';
    if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
      status.textContent = 'Camera permission denied — please type the ISBN instead';
    } else {
      status.textContent = 'Camera unavailable — please type the ISBN below';
    }
  }
}

function startScanLoop(video) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d', { willReadFrequently: true });

  scanInterval = setInterval(async () => {
    if (!scannerActive || !zxingReady || video.readyState < 2 || !readBarcodesFn) return;

    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return;

    canvas.width = w;
    canvas.height = h;
    ctx.drawImage(video, 0, 0, w, h);

    try {
      // Convert to Blob — more reliable ZXing input than raw ImageData
      const blob = await new Promise(res => canvas.toBlob(res, 'image/jpeg', 0.85));
      if (!blob) return;

      const results = await readBarcodesFn(blob, {
        tryHarder: true,
        formats: ['EAN13', 'EAN8', 'ISBN'],
        maxNumberOfSymbols: 1
      });

      if (results && results.length > 0) {
        const raw = results[0].text;
        const clean = raw.replace(/\D/g, '');
        if (clean.length === 13 && (clean.startsWith('978') || clean.startsWith('979'))) {
          onBarcodeDetected(clean);
        }
      }
    } catch(e) {
      // Silent — try next frame
    }
  }, 300);
}

function onBarcodeDetected(isbn) {
  scannerActive = false;
  const status = document.getElementById('cameraStatus');
  status.className = 'camera-status success';
  status.textContent = `Found: ${isbn}`;

  const reticle = document.querySelector('.reticle-inner');
  reticle.style.outline = '2px solid var(--gold-light)';
  reticle.style.boxShadow = '0 0 24px rgba(212, 168, 67, 0.5)';

  setTimeout(async () => {
    closeCamera();
    document.getElementById('isbnInput').value = isbn;
    await lookupISBN();
    if (currentBook) {
      openModal();
    } else {
      document.querySelector('.scanner-section').scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 700);
}

function closeCamera() {
  scannerActive = false;
  clearInterval(scanInterval);
  scanInterval = null;

  if (videoStream) {
    videoStream.getTracks().forEach(t => t.stop());
    videoStream = null;
  }

  const video = document.getElementById('cameraVideo');
  video.srcObject = null;

  document.getElementById('cameraOverlay').classList.remove('open');

  const reticle = document.querySelector('.reticle-inner');
  if (reticle) { reticle.style.outline = ''; reticle.style.boxShadow = ''; }
}
