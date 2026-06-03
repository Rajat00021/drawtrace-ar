/* ============================================================
   AR TRACING STUDIO — script.js
   All logic: image loading, camera, canvas overlay, controls
   ============================================================ */

'use strict';

// ─── State ────────────────────────────────────────────────────
const state = {
    imageLoaded: null,      // HTMLImageElement or ImageData
    cameraStream: null,
    animFrameId: null,
    isLocked: false,
    isInverted: false,
    flipH: false,
    flipV: false,

    // Transform (canvas-relative center position)
    posX: 0,
    posY: 0,
    scale: 1.0,
    rotation: 0,          // degrees
    opacity: 0.70,

    // Drag state
    isDragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragImgStartX: 0,
    dragImgStartY: 0,

    // Pinch state
    isPinching: false,
    pinchStartDist: 0,
    pinchStartScale: 1,
};

// ─── DOM References ────────────────────────────────────────────
const dashboardView   = document.getElementById('dashboardView');
const workspaceView   = document.getElementById('workspaceView');

const googleSearchInput = document.getElementById('googleSearchInput');
const googleSearchBtn   = document.getElementById('googleSearchBtn');
const fileInput         = document.getElementById('fileInput');
const browseBtn         = document.getElementById('browseBtn');
const dropZone          = document.getElementById('dropZone');
const urlInput          = document.getElementById('urlInput');
const urlLoadBtn        = document.getElementById('urlLoadBtn');

const previewEmpty      = document.getElementById('previewEmpty');
const previewLoaded     = document.getElementById('previewLoaded');
const previewImg        = document.getElementById('previewImg');
const previewName       = document.getElementById('previewName');
const previewSize       = document.getElementById('previewSize');
const openCameraBtn     = document.getElementById('openCameraBtn');

const controlsSheet     = document.getElementById('controlsSheet');
const sheetHandleWrap   = document.getElementById('sheetHandleWrap');
const cameraFeed        = document.getElementById('cameraFeed');
const overlayCanvas     = document.getElementById('overlayCanvas');
const lockOverlay       = document.getElementById('lockOverlay');
const backBtn           = document.getElementById('backBtn');
const lockBtn           = document.getElementById('lockBtn');
const lockIcon          = document.getElementById('lockIcon');

const opacitySlider     = document.getElementById('opacitySlider');
const opacityValue      = document.getElementById('opacityValue');
const zoomSlider        = document.getElementById('zoomSlider');
const zoomValue         = document.getElementById('zoomValue');
const rotateSlider      = document.getElementById('rotateSlider');
const rotateValue       = document.getElementById('rotateValue');

const flipHBtn          = document.getElementById('flipHBtn');
const flipVBtn          = document.getElementById('flipVBtn');
const invertBtn         = document.getElementById('invertBtn');
const resetBtn          = document.getElementById('resetBtn');

const toastContainer    = document.getElementById('toastContainer');
const modalOverlay      = document.getElementById('modalOverlay');
const modalTitle        = document.getElementById('modalTitle');
const modalMessage      = document.getElementById('modalMessage');
const modalCloseBtn     = document.getElementById('modalCloseBtn');

const ctx               = overlayCanvas.getContext('2d', { willReadFrequently: true });

// ─── Utility: Toast ────────────────────────────────────────────
function showToast(msg, type = 'info', duration = 3000) {
    const icons = { success: 'fa-circle-check', error: 'fa-circle-xmark', info: 'fa-circle-info' };
    const toast = document.createElement('div');
    toast.className = `toast ${type}`;
    toast.innerHTML = `<i class="fas ${icons[type] || icons.info}"></i> ${msg}`;
    toastContainer.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        toast.addEventListener('animationend', () => toast.remove());
    }, duration);
}

// ─── Utility: Modal ────────────────────────────────────────────
function showModal(title, msg) {
    modalTitle.textContent = title;
    modalMessage.textContent = msg;
    modalOverlay.style.display = 'flex';
}
modalCloseBtn.addEventListener('click', () => { modalOverlay.style.display = 'none'; });

// ─── View Transitions ──────────────────────────────────────────
function showView(id) {
    document.querySelectorAll('.view').forEach(v => v.classList.remove('active'));
    document.getElementById(id).classList.add('active');
}

// ─── Google PNG Search ─────────────────────────────────────────
function doGoogleSearch() {
    const query = googleSearchInput.value.trim();
    if (!query) { showToast('Type something to search!', 'error'); return; }
    // Filter: transparent PNG images only
    const url = `https://www.google.com/search?q=${encodeURIComponent(query + ' PNG transparent')}&tbm=isch&tbs=ic:trans,ift:png`;
    window.open(url, '_blank');
    showToast('Google Images opened in a new tab. Download a PNG and import it below!', 'info', 5000);
}
googleSearchBtn.addEventListener('click', doGoogleSearch);
googleSearchInput.addEventListener('keydown', e => { if (e.key === 'Enter') doGoogleSearch(); });

// ─── Load Image into App ───────────────────────────────────────
function loadImage(src, name = 'image') {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'Anonymous';
        img.onload = () => {
            state.imageLoaded = img;
            previewImg.src = img.src;
            previewName.textContent = name.length > 30 ? name.slice(0, 27) + '…' : name;
            previewEmpty.style.display = 'none';
            previewLoaded.style.display = 'flex';
            showToast('Image loaded! Click "Open Camera & Trace"', 'success');
            resolve(img);
        };
        img.onerror = () => {
            reject(new Error('Failed to load image. Try downloading it and uploading locally.'));
        };
        img.src = src;
    });
}

// File upload
browseBtn.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('click', () => fileInput.click());
fileInput.addEventListener('change', () => {
    const file = fileInput.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { showToast('Please select an image file.', 'error'); return; }
    const reader = new FileReader();
    reader.onload = e => loadImage(e.target.result, file.name).catch(err => showModal('Load Error', err.message));
    const sizeMB = (file.size / 1024 / 1024).toFixed(1);
    previewSize.textContent = `${sizeMB} MB`;
    reader.readAsDataURL(file);
});

// Drag & Drop onto drop zone
dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
dropZone.addEventListener('drop', e => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = ev => loadImage(ev.target.result, file.name).catch(err => showModal('Load Error', err.message));
        reader.readAsDataURL(file);
    } else {
        // Maybe they dragged an image element from the browser
        const imgSrc = e.dataTransfer.getData('text/uri-list') || e.dataTransfer.getData('text/plain');
        if (imgSrc) loadImageFromUrl(imgSrc);
        else showToast('Drop an image file here.', 'error');
    }
});

// URL Load
function loadImageFromUrl(rawUrl) {
    const url = rawUrl.trim();
    if (!url) { showToast('Paste a valid image URL.', 'error'); return; }
    previewSize.textContent = '';
    loadImage(url, url.split('/').pop().split('?')[0] || 'image')
        .catch(() => {
            showModal(
                'CORS Blocked',
                'This image cannot be loaded directly due to browser security policies. Please save it to your device and import it using the Browse Files button.'
            );
        });
}
urlLoadBtn.addEventListener('click', () => loadImageFromUrl(urlInput.value));
urlInput.addEventListener('keydown', e => { if (e.key === 'Enter') loadImageFromUrl(urlInput.value); });

// ─── Camera ────────────────────────────────────────────────────
openCameraBtn.addEventListener('click', async () => {
    if (!state.imageLoaded) { showToast('Load an image first!', 'error'); return; }
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
        });
        state.cameraStream = stream;
        cameraFeed.srcObject = stream;
        await cameraFeed.play();
        resetTransforms();
        showView('workspaceView');
        startRenderLoop();
        showToast('Camera active — place device over paper and trace!', 'success', 4000);
    } catch (err) {
        if (err.name === 'NotAllowedError') {
            showModal('Camera Permission Denied', 'Please allow camera access in your browser settings and refresh the page.');
        } else if (err.name === 'NotFoundError') {
            showModal('No Camera Found', 'No camera was detected on this device.');
        } else {
            showModal('Camera Error', err.message || 'Could not start camera.');
        }
    }
});

// ─── Back Button ───────────────────────────────────────────────
backBtn.addEventListener('click', () => {
    stopCamera();
    showView('dashboardView');
});
function stopCamera() {
    if (state.cameraStream) {
        state.cameraStream.getTracks().forEach(t => t.stop());
        state.cameraStream = null;
    }
    if (state.animFrameId) { cancelAnimationFrame(state.animFrameId); state.animFrameId = null; }
    cameraFeed.srcObject = null;
}

// ─── Canvas Resize ─────────────────────────────────────────────
function resizeCanvas() {
    overlayCanvas.width  = window.innerWidth;
    overlayCanvas.height = window.innerHeight;
}
window.addEventListener('resize', () => { resizeCanvas(); });
resizeCanvas();

// ─── Reset Transforms ──────────────────────────────────────────
function resetTransforms() {
    // Reset sheet to expanded on new workspace open
    controlsSheet.classList.remove('collapsed');
    state.sheetCollapsed = false;
    updateSheetHint();

    state.posX     = overlayCanvas.width / 2;
    state.posY     = overlayCanvas.height / 2 - 80; // shift up a bit above controls
    state.scale    = 1.0;
    state.rotation = 0;
    state.flipH    = false;
    state.flipV    = false;
    state.isInverted = false;

    opacitySlider.value  = 70;
    state.opacity        = 0.70;
    opacityValue.textContent = '70%';

    zoomSlider.value     = 100;
    zoomValue.textContent = '100%';

    rotateSlider.value   = 0;
    rotateValue.textContent = '0°';

    flipHBtn.classList.remove('active');
    flipVBtn.classList.remove('active');
    invertBtn.classList.remove('active');
}

// ─── Render Loop ───────────────────────────────────────────────
function startRenderLoop() {
    function loop() {
        drawOverlay();
        state.animFrameId = requestAnimationFrame(loop);
    }
    loop();
}

function drawOverlay() {
    resizeCanvas(); // keep in sync
    ctx.clearRect(0, 0, overlayCanvas.width, overlayCanvas.height);

    if (!state.imageLoaded) return;

    const img = state.imageLoaded;
    const W = overlayCanvas.width;
    const H = overlayCanvas.height;

    // Compute draw size: fit image within 80% of screen, scaled
    const maxW = W * 0.8;
    const maxH = (H - 260) * 0.85; // leave room for controls sheet
    const ratio = Math.min(maxW / img.naturalWidth, maxH / img.naturalHeight);
    const drawW = img.naturalWidth  * ratio * state.scale;
    const drawH = img.naturalHeight * ratio * state.scale;

    ctx.save();
    ctx.globalAlpha = state.opacity;

    // Move to image center position
    ctx.translate(state.posX, state.posY);
    ctx.rotate((state.rotation * Math.PI) / 180);
    ctx.scale(state.flipH ? -1 : 1, state.flipV ? -1 : 1);

    if (state.isInverted) {
        // Draw image normally first to an offscreen canvas and invert
        const off = document.createElement('canvas');
        off.width = drawW; off.height = drawH;
        const offCtx = off.getContext('2d');
        offCtx.drawImage(img, 0, 0, drawW, drawH);
        // Edge detection via inversion
        offCtx.globalCompositeOperation = 'difference';
        offCtx.fillStyle = 'white';
        offCtx.fillRect(0, 0, drawW, drawH);
        ctx.drawImage(off, -drawW / 2, -drawH / 2);
    } else {
        ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH);
    }

    ctx.restore();
}

// ─── Sliders ───────────────────────────────────────────────────
opacitySlider.addEventListener('input', () => {
    state.opacity = opacitySlider.value / 100;
    opacityValue.textContent = opacitySlider.value + '%';
});

zoomSlider.addEventListener('input', () => {
    state.scale = zoomSlider.value / 100;
    zoomValue.textContent = zoomSlider.value + '%';
});

rotateSlider.addEventListener('input', () => {
    state.rotation = parseInt(rotateSlider.value);
    rotateValue.textContent = rotateSlider.value + '°';
});

// ─── Quick Action Buttons ──────────────────────────────────────
flipHBtn.addEventListener('click', () => {
    state.flipH = !state.flipH;
    flipHBtn.classList.toggle('active', state.flipH);
    showToast('Flipped Horizontal', 'info', 1200);
});
flipVBtn.addEventListener('click', () => {
    state.flipV = !state.flipV;
    flipVBtn.classList.toggle('active', state.flipV);
    showToast('Flipped Vertical', 'info', 1200);
});
invertBtn.addEventListener('click', () => {
    state.isInverted = !state.isInverted;
    invertBtn.classList.toggle('active', state.isInverted);
    showToast(state.isInverted ? 'Outline mode ON' : 'Outline mode OFF', 'info', 1500);
});
resetBtn.addEventListener('click', () => {
    resetTransforms();
    showToast('Transforms reset!', 'info', 1500);
});

// ─── Lock Canvas ───────────────────────────────────────────────
lockBtn.addEventListener('click', () => {
    state.isLocked = !state.isLocked;
    lockIcon.className = state.isLocked ? 'fas fa-lock' : 'fas fa-lock-open';
    lockBtn.classList.toggle('locked', state.isLocked);
    lockOverlay.style.display = state.isLocked ? 'flex' : 'none';
    showToast(state.isLocked ? '🔒 Canvas locked — trace freely!' : '🔓 Canvas unlocked', state.isLocked ? 'success' : 'info', 1800);
});

// ─── Touch / Mouse Drag on Canvas ──────────────────────────────

// Mouse drag
overlayCanvas.addEventListener('mousedown', e => {
    if (state.isLocked) return;
    state.isDragging = true;
    state.dragStartX = e.clientX;
    state.dragStartY = e.clientY;
    state.dragImgStartX = state.posX;
    state.dragImgStartY = state.posY;
    overlayCanvas.style.cursor = 'grabbing';
});
window.addEventListener('mousemove', e => {
    if (!state.isDragging) return;
    state.posX = state.dragImgStartX + (e.clientX - state.dragStartX);
    state.posY = state.dragImgStartY + (e.clientY - state.dragStartY);
});
window.addEventListener('mouseup', () => {
    state.isDragging = false;
    overlayCanvas.style.cursor = 'grab';
});

// Touch drag + pinch zoom
overlayCanvas.addEventListener('touchstart', e => {
    if (state.isLocked) return;
    if (e.touches.length === 1) {
        state.isDragging = true;
        state.dragStartX = e.touches[0].clientX;
        state.dragStartY = e.touches[0].clientY;
        state.dragImgStartX = state.posX;
        state.dragImgStartY = state.posY;
    } else if (e.touches.length === 2) {
        state.isDragging = false;
        state.isPinching = true;
        state.pinchStartDist  = getTouchDist(e.touches);
        state.pinchStartScale = state.scale;
    }
}, { passive: true });

overlayCanvas.addEventListener('touchmove', e => {
    if (state.isLocked) return;
    if (state.isDragging && e.touches.length === 1) {
        state.posX = state.dragImgStartX + (e.touches[0].clientX - state.dragStartX);
        state.posY = state.dragImgStartY + (e.touches[0].clientY - state.dragStartY);
    } else if (state.isPinching && e.touches.length === 2) {
        const dist = getTouchDist(e.touches);
        const newScale = state.pinchStartScale * (dist / state.pinchStartDist);
        state.scale = Math.max(0.1, Math.min(5, newScale));
        // Sync zoom slider (clamped to its range)
        zoomSlider.value = Math.min(300, Math.max(10, Math.round(state.scale * 100)));
        zoomValue.textContent = Math.round(state.scale * 100) + '%';
    }
}, { passive: true });

overlayCanvas.addEventListener('touchend', e => {
    if (e.touches.length < 2) state.isPinching = false;
    if (e.touches.length === 0) state.isDragging = false;
}, { passive: true });

function getTouchDist(touches) {
    const dx = touches[0].clientX - touches[1].clientX;
    const dy = touches[0].clientY - touches[1].clientY;
    return Math.sqrt(dx * dx + dy * dy);
}

// Scroll wheel zoom on desktop
overlayCanvas.addEventListener('wheel', e => {
    if (state.isLocked) return;
    e.preventDefault();
    const delta = e.deltaY > 0 ? -0.05 : 0.05;
    state.scale = Math.max(0.1, Math.min(5, state.scale + delta));
    zoomSlider.value = Math.min(300, Math.max(10, Math.round(state.scale * 100)));
    zoomValue.textContent = Math.round(state.scale * 100) + '%';
}, { passive: false });

// ─── Sheet Collapse Toggle ─────────────────────────────────────
state.sheetCollapsed = false;

function updateSheetHint() {
    const hint = document.querySelector('.sheet-collapse-hint');
    if (hint) hint.textContent = state.sheetCollapsed ? 'TAP TO SHOW' : 'TAP TO HIDE';
}

sheetHandleWrap.addEventListener('click', () => {
    state.sheetCollapsed = !state.sheetCollapsed;
    controlsSheet.classList.toggle('collapsed', state.sheetCollapsed);
    updateSheetHint();
});

// Also allow double-tap on camera feed to toggle sheet
let lastTap = 0;
overlayCanvas.addEventListener('touchend', e => {
    const now = Date.now();
    if (now - lastTap < 300 && e.touches.length === 0) {
        state.sheetCollapsed = !state.sheetCollapsed;
        controlsSheet.classList.toggle('collapsed', state.sheetCollapsed);
        updateSheetHint();
    }
    lastTap = now;
}, { passive: true });

// ─── Init ──────────────────────────────────────────────────────
overlayCanvas.style.cursor = 'grab';
showView('dashboardView');
