// ===== DOM References =====
const cameraScreen = document.getElementById('camera-screen');
const editorScreen = document.getElementById('editor-screen');
const cameraFeed = document.getElementById('camera-feed');
const btnCapture = document.getElementById('btn-capture');
const btnFlip = document.getElementById('btn-flip');
const btnGallery = document.getElementById('btn-gallery');
const galleryInput = document.getElementById('gallery-input');
const btnBack = document.getElementById('btn-back');
const btnSave = document.getElementById('btn-save');
const editorCanvas = document.getElementById('editor-canvas');
const ctx = editorCanvas.getContext('2d');
const stickerLayer = document.getElementById('sticker-layer');
const cropOverlay = document.getElementById('crop-overlay');
const cropBox = document.getElementById('crop-box');
const toast = document.getElementById('toast');

// Sub-toolbars
const drawOptions = document.getElementById('draw-options');
const emojiPicker = document.getElementById('emoji-picker');
const filterOptions = document.getElementById('filter-options');
const cropActions = document.getElementById('crop-actions');
const textOptions = document.getElementById('text-options');

// ===== State =====
let currentStream = null;
let facingMode = 'environment';
let originalImage = null; // Original captured image (before filters)
let baseImage = null;     // Image with filter applied (base for drawing)
let currentFilter = 'none';
let activeTool = null;

// Drawing state
let drawColor = '#FFFFFF';
let drawSize = 3;
let isDrawing = false;
let drawPaths = []; // Array of paths for undo
let currentPath = null;

// Crop state
let cropRatio = 'free';
let cropDragging = null; // 'move' | 'tl' | 'tr' | 'bl' | 'br'
let cropStart = {};
let cropRect = {};

// Sticker drag state
let dragSticker = null;
let dragOffset = { x: 0, y: 0 };
let dragStartPos = { x: 0, y: 0 };
let pinchStartDist = null;
let pinchStartScale = 1;

// ===== Filters =====
const FILTERS = [
  { name: 'Original', value: 'none', css: 'none' },
  { name: 'Mono', value: 'grayscale', css: 'grayscale(100%)' },
  { name: 'Sepia', value: 'sepia', css: 'sepia(100%)' },
  { name: 'Warm', value: 'warm', css: 'sepia(30%) saturate(140%) brightness(105%)' },
  { name: 'Cool', value: 'cool', css: 'saturate(80%) hue-rotate(20deg) brightness(105%)' },
  { name: 'Vivid', value: 'vivid', css: 'saturate(180%) contrast(110%)' },
  { name: 'Fade', value: 'fade', css: 'contrast(90%) brightness(110%) saturate(80%)' },
  { name: 'Dramatic', value: 'drama', css: 'contrast(140%) brightness(90%)' },
  { name: 'Noir', value: 'noir', css: 'grayscale(100%) contrast(130%) brightness(90%)' },
  { name: 'Tonal', value: 'tonal', css: 'sepia(20%) saturate(60%) brightness(105%) contrast(95%)' },
];

// ===== Emojis (categorized) =====
const EMOJI_CATS = {
  recent: ['🔥','❤️','😂','✨','💯','🥺','😍','👀','💀','🎉','😎','🥳','😭','🤩','💅','🚀'],
  smileys: ['😀','😂','🤣','😍','🥰','😘','😎','🤩','🥳','😭','🥺','😤','🤯','😱','🫠','😈','💀','👻','🤖','👽'],
  gestures: ['👍','👎','✌️','🤟','🤙','💪','🙏','👏','🫶','👀','💅','🤝','✋','👋','🫡','☝️','👆','🖐️','🤌','🫰'],
  symbols: ['❤️','🧡','💛','💚','💙','💜','🖤','🤍','💔','❤️‍🔥','✨','💫','⭐','🌟','💯','🔥','💎','👑','🎵','🎶'],
  nature: ['🌸','🌺','🌻','🌈','☀️','🌙','❄️','⚡','🦋','🐱','🐶','🦊','🐸','🌴','🍕','🍦','🎮','📸','🚀','🎉'],
};

// ===== Camera =====
async function startCamera() {
  try {
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
    }
    const constraints = {
      video: {
        facingMode,
        width: { ideal: 1920 },
        height: { ideal: 1080 },
      },
      audio: false,
    };
    currentStream = await navigator.mediaDevices.getUserMedia(constraints);
    cameraFeed.srcObject = currentStream;
    await cameraFeed.play();
  } catch (err) {
    showToast('Camera access denied');
    console.error('Camera error:', err);
  }
}

function capturePhoto() {
  const video = cameraFeed;
  const w = video.videoWidth;
  const h = video.videoHeight;
  if (!w || !h) return;

  const tmpCanvas = document.createElement('canvas');
  tmpCanvas.width = w;
  tmpCanvas.height = h;
  const tmpCtx = tmpCanvas.getContext('2d');

  // Mirror front camera
  if (facingMode === 'user') {
    tmpCtx.translate(w, 0);
    tmpCtx.scale(-1, 1);
  }
  tmpCtx.drawImage(video, 0, 0, w, h);

  const img = new Image();
  img.onload = () => {
    originalImage = img;
    openEditor(img);
  };
  img.src = tmpCanvas.toDataURL('image/jpeg', 0.92);
}

btnCapture.addEventListener('click', capturePhoto);

btnFlip.addEventListener('click', () => {
  facingMode = facingMode === 'environment' ? 'user' : 'environment';
  startCamera();
});

btnGallery.addEventListener('click', () => galleryInput.click());
galleryInput.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = (ev) => {
    const img = new Image();
    img.onload = () => {
      originalImage = img;
      openEditor(img);
    };
    img.src = ev.target.result;
  };
  reader.readAsDataURL(file);
  galleryInput.value = '';
});

// ===== Editor =====
function openEditor(img) {
  // Stop camera to save resources
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
    currentStream = null;
  }

  // Reset state
  drawPaths = [];
  currentFilter = 'none';
  activeTool = null;
  stickerLayer.innerHTML = '';
  hideAllSubToolbars();
  clearToolActive();

  // Show editor FIRST so container has layout dimensions
  cameraScreen.classList.remove('active');
  editorScreen.classList.add('active');

  // Size canvas to fit image (container must be visible for clientWidth/Height)
  const container = document.getElementById('editor-canvas-container');
  const maxW = container.clientWidth;
  const maxH = container.clientHeight;
  const scale = Math.min(maxW / img.width, maxH / img.height, 1);
  editorCanvas.width = Math.round(img.width * scale);
  editorCanvas.height = Math.round(img.height * scale);

  // Draw image
  ctx.drawImage(img, 0, 0, editorCanvas.width, editorCanvas.height);
  baseImage = ctx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);

  // Position sticker layer to match canvas
  positionStickerLayer();

  // Build filter previews
  buildFilterPreviews(img);
}

function positionStickerLayer() {
  const rect = editorCanvas.getBoundingClientRect();
  const container = document.getElementById('editor-canvas-container');
  const cRect = container.getBoundingClientRect();
  stickerLayer.style.left = (rect.left - cRect.left) + 'px';
  stickerLayer.style.top = (rect.top - cRect.top) + 'px';
  stickerLayer.style.width = rect.width + 'px';
  stickerLayer.style.height = rect.height + 'px';
}

function closeEditor() {
  editorScreen.classList.remove('active');
  cameraScreen.classList.add('active');
  stickerLayer.innerHTML = '';
  hideAllSubToolbars();
  clearToolActive();
  startCamera();
}

btnBack.addEventListener('click', closeEditor);

// ===== Tool Selection =====
document.querySelectorAll('[data-tool]').forEach(btn => {
  btn.addEventListener('click', () => {
    const tool = btn.dataset.tool;
    if (activeTool === tool) {
      deactivateTool();
      return;
    }
    activateTool(tool);
  });
});

function activateTool(tool) {
  deactivateTool();
  activeTool = tool;
  clearToolActive();
  document.querySelector(`[data-tool="${tool}"]`).classList.add('active');

  hideAllSubToolbars();
  deselectAllStickers();

  if (tool === 'draw') {
    drawOptions.classList.remove('hidden');
    editorCanvas.style.cursor = 'crosshair';
  } else if (tool === 'emoji') {
    emojiPicker.classList.remove('hidden');
    buildEmojiGrid();
  } else if (tool === 'filter') {
    filterOptions.classList.remove('hidden');
  } else if (tool === 'crop') {
    startCrop();
  } else if (tool === 'text') {
    textOptions.classList.remove('hidden');
    document.getElementById('text-input').focus();
  }
}

function deactivateTool() {
  if (activeTool === 'crop') {
    cancelCrop();
  }
  activeTool = null;
  clearToolActive();
  hideAllSubToolbars();
  editorCanvas.style.cursor = '';
}

function clearToolActive() {
  document.querySelectorAll('[data-tool]').forEach(b => b.classList.remove('active'));
}

function hideAllSubToolbars() {
  [drawOptions, emojiPicker, filterOptions, cropActions, textOptions].forEach(el => {
    el.classList.add('hidden');
  });
}

// ===== Drawing =====
function getCanvasPos(e) {
  const rect = editorCanvas.getBoundingClientRect();
  const touch = e.touches ? e.touches[0] : e;
  return {
    x: (touch.clientX - rect.left) * (editorCanvas.width / rect.width),
    y: (touch.clientY - rect.top) * (editorCanvas.height / rect.height),
  };
}

editorCanvas.addEventListener('pointerdown', (e) => {
  if (activeTool !== 'draw') return;
  e.preventDefault();
  editorCanvas.setPointerCapture(e.pointerId);
  isDrawing = true;
  const pos = getCanvasPos(e);
  currentPath = { color: drawColor, size: drawSize, points: [pos] };
});

editorCanvas.addEventListener('pointermove', (e) => {
  if (!isDrawing || activeTool !== 'draw') return;
  e.preventDefault();
  const pos = getCanvasPos(e);
  currentPath.points.push(pos);
  redrawCanvas();
  drawSinglePath(currentPath);
});

editorCanvas.addEventListener('pointerup', (e) => {
  if (!isDrawing) return;
  isDrawing = false;
  if (currentPath && currentPath.points.length > 0) {
    drawPaths.push(currentPath);
    currentPath = null;
    redrawCanvas();
  }
});

editorCanvas.addEventListener('pointercancel', () => {
  isDrawing = false;
  currentPath = null;
});

function drawSinglePath(path) {
  if (path.points.length < 2) {
    // Draw a dot
    ctx.beginPath();
    ctx.arc(path.points[0].x, path.points[0].y, path.size / 2, 0, Math.PI * 2);
    ctx.fillStyle = path.color;
    ctx.fill();
    return;
  }
  ctx.beginPath();
  ctx.strokeStyle = path.color;
  ctx.lineWidth = path.size;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.moveTo(path.points[0].x, path.points[0].y);
  for (let i = 1; i < path.points.length; i++) {
    ctx.lineTo(path.points[i].x, path.points[i].y);
  }
  ctx.stroke();
}

function redrawCanvas() {
  ctx.putImageData(baseImage, 0, 0);
  drawPaths.forEach(drawSinglePath);
}

// Draw toolbar controls
document.querySelectorAll('.size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    drawSize = parseInt(btn.dataset.size);
  });
});

document.querySelectorAll('#color-palette .color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#color-palette .color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    drawColor = btn.dataset.color;
  });
});

document.getElementById('btn-undo-draw').addEventListener('click', () => {
  if (drawPaths.length > 0) {
    drawPaths.pop();
    redrawCanvas();
  }
});

// ===== Emoji Picker =====
let currentEmojiCat = 'recent';

function buildEmojiGrid(cat = currentEmojiCat) {
  currentEmojiCat = cat;
  const grid = document.getElementById('emoji-grid');
  grid.innerHTML = '';
  const emojis = EMOJI_CATS[cat] || EMOJI_CATS.recent;
  emojis.forEach(emoji => {
    const btn = document.createElement('button');
    btn.textContent = emoji;
    btn.addEventListener('click', () => addSticker(emoji, 'emoji'));
    grid.appendChild(btn);
  });
  // Update category buttons
  document.querySelectorAll('.emoji-cat-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.cat === cat);
  });
}

document.querySelectorAll('.emoji-cat-btn').forEach(btn => {
  btn.addEventListener('click', () => buildEmojiGrid(btn.dataset.cat));
});

function addSticker(content, type) {
  const el = document.createElement('div');
  el.className = `sticker ${type === 'emoji' ? 'emoji' : 'text-sticker'}`;
  el.textContent = content;
  if (type === 'text') {
    el.style.color = content.color || '#FFFFFF';
    el.textContent = content.text || content;
  }

  // Delete button
  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    el.remove();
  });
  el.appendChild(delBtn);

  // Position center of sticker layer
  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el._scale = 1;
  el._rotation = 0;
  el._translateX = 0;
  el._translateY = 0;

  // Touch/mouse dragging
  setupStickerInteraction(el);

  stickerLayer.appendChild(el);
  selectSticker(el);
}

function selectSticker(el) {
  deselectAllStickers();
  el.classList.add('selected');
}

function deselectAllStickers() {
  document.querySelectorAll('.sticker.selected').forEach(s => s.classList.remove('selected'));
}

function setupStickerInteraction(el) {
  let startTouches = null;

  el.addEventListener('pointerdown', (e) => {
    if (activeTool === 'draw') return;
    e.stopPropagation();
    selectSticker(el);
    dragSticker = el;
    const rect = el.getBoundingClientRect();
    dragOffset.x = e.clientX - rect.left - rect.width / 2;
    dragOffset.y = e.clientY - rect.top - rect.height / 2;
  });

  el.addEventListener('touchstart', (e) => {
    if (e.touches.length === 2) {
      e.preventDefault();
      startTouches = getTouchData(e);
      pinchStartScale = el._scale || 1;
    }
  }, { passive: false });

  el.addEventListener('touchmove', (e) => {
    if (e.touches.length === 2 && startTouches) {
      e.preventDefault();
      const current = getTouchData(e);
      const scaleRatio = current.dist / startTouches.dist;
      el._scale = Math.max(0.3, Math.min(5, pinchStartScale * scaleRatio));
      updateStickerTransform(el);
    }
  }, { passive: false });

  el.addEventListener('touchend', () => {
    startTouches = null;
  });
}

function getTouchData(e) {
  const t1 = e.touches[0];
  const t2 = e.touches[1];
  const dx = t2.clientX - t1.clientX;
  const dy = t2.clientY - t1.clientY;
  return {
    dist: Math.sqrt(dx * dx + dy * dy),
    cx: (t1.clientX + t2.clientX) / 2,
    cy: (t1.clientY + t2.clientY) / 2,
  };
}

function updateStickerTransform(el) {
  const tx = el._translateX || 0;
  const ty = el._translateY || 0;
  const s = el._scale || 1;
  el.style.transform = `translate(calc(-50% + ${tx}px), calc(-50% + ${ty}px)) scale(${s})`;
}

// Global pointer move/up for sticker dragging
document.addEventListener('pointermove', (e) => {
  if (!dragSticker) return;
  const layerRect = stickerLayer.getBoundingClientRect();
  const x = e.clientX - layerRect.left - dragOffset.x;
  const y = e.clientY - layerRect.top - dragOffset.y;
  const pctX = (x / layerRect.width) * 100;
  const pctY = (y / layerRect.height) * 100;
  dragSticker.style.left = pctX + '%';
  dragSticker.style.top = pctY + '%';
  dragSticker._translateX = 0;
  dragSticker._translateY = 0;
  updateStickerTransform(dragSticker);
});

document.addEventListener('pointerup', () => {
  dragSticker = null;
});

// Deselect stickers when tapping canvas area
document.getElementById('editor-canvas-container').addEventListener('pointerdown', (e) => {
  if (e.target === editorCanvas || e.target === stickerLayer) {
    deselectAllStickers();
  }
});

// ===== Text Tool =====
let textSize = 28;
let textStyle = 'blur'; // 'blur' | 'plain' | 'solid'

document.getElementById('btn-add-text').addEventListener('click', () => {
  const input = document.getElementById('text-input');
  const text = input.value.trim();
  if (!text) return;

  const activeColor = document.querySelector('#text-colors .color-btn.active');
  const color = activeColor ? activeColor.dataset.color : '#FFFFFF';

  const el = document.createElement('div');
  el.className = `sticker text-sticker style-${textStyle}`;
  el.style.fontSize = textSize + 'px';

  if (textStyle === 'solid') {
    el.style.background = color;
    el.style.color = isLightColor(color) ? '#000' : '#fff';
  } else {
    el.style.color = color;
  }

  // Store metadata for export
  el._textStyle = textStyle;
  el._textColor = color;
  el._fontSize = textSize;

  const textNode = document.createTextNode(text);
  el.appendChild(textNode);

  const delBtn = document.createElement('button');
  delBtn.className = 'delete-btn';
  delBtn.textContent = '×';
  delBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    el.remove();
  });
  el.appendChild(delBtn);

  el.style.left = '50%';
  el.style.top = '50%';
  el.style.transform = 'translate(-50%, -50%)';
  el._scale = 1;
  el._translateX = 0;
  el._translateY = 0;

  setupStickerInteraction(el);
  stickerLayer.appendChild(el);
  selectSticker(el);

  input.value = '';
});

function isLightColor(hex) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 160;
}

// Text size buttons
document.querySelectorAll('.text-size-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.text-size-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    textSize = parseInt(btn.dataset.size);
  });
});

// Text style buttons
document.querySelectorAll('.text-style-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.text-style-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    textStyle = btn.dataset.style;
  });
});

document.querySelectorAll('#text-colors .color-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('#text-colors .color-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ===== Filters =====
function buildFilterPreviews(img) {
  const list = document.getElementById('filter-list');
  list.innerHTML = '';

  FILTERS.forEach(f => {
    const btn = document.createElement('button');
    btn.className = 'filter-preview' + (f.value === currentFilter ? ' active' : '');

    const preview = document.createElement('canvas');
    preview.width = 64;
    preview.height = 64;
    const pCtx = preview.getContext('2d');

    // Draw thumbnail with filter
    const size = Math.min(img.width, img.height);
    const sx = (img.width - size) / 2;
    const sy = (img.height - size) / 2;
    if (f.css !== 'none') pCtx.filter = f.css;
    pCtx.drawImage(img, sx, sy, size, size, 0, 0, 64, 64);
    pCtx.filter = 'none';

    const label = document.createElement('span');
    label.textContent = f.name;

    btn.appendChild(preview);
    btn.appendChild(label);

    btn.addEventListener('click', () => {
      currentFilter = f.value;
      applyFilter(f);
      list.querySelectorAll('.filter-preview').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
    });

    list.appendChild(btn);
  });
}

function applyFilter(f) {
  // Redraw original image with filter
  if (f.css !== 'none') {
    ctx.filter = f.css;
  } else {
    ctx.filter = 'none';
  }
  ctx.drawImage(originalImage, 0, 0, editorCanvas.width, editorCanvas.height);
  ctx.filter = 'none';

  // Save as new base
  baseImage = ctx.getImageData(0, 0, editorCanvas.width, editorCanvas.height);

  // Redraw paths on top
  drawPaths.forEach(drawSinglePath);
}

// ===== Crop =====
function startCrop() {
  cropOverlay.classList.remove('hidden');
  cropActions.classList.remove('hidden');

  // Init crop box to full canvas area
  const canvasRect = editorCanvas.getBoundingClientRect();
  const containerRect = document.getElementById('editor-canvas-container').getBoundingClientRect();

  cropRect = {
    left: canvasRect.left - containerRect.left + 10,
    top: canvasRect.top - containerRect.top + 10,
    width: canvasRect.width - 20,
    height: canvasRect.height - 20,
  };
  updateCropBox();
  setupCropInteraction();
}

function cancelCrop() {
  cropOverlay.classList.add('hidden');
  cropActions.classList.add('hidden');
}

function updateCropBox() {
  cropBox.style.left = cropRect.left + 'px';
  cropBox.style.top = cropRect.top + 'px';
  cropBox.style.width = cropRect.width + 'px';
  cropBox.style.height = cropRect.height + 'px';
}

function setupCropInteraction() {
  const handles = cropBox.querySelectorAll('.crop-handle');

  function onPointerDown(e, type) {
    e.preventDefault();
    e.stopPropagation();
    cropDragging = type;
    cropStart = { x: e.clientX, y: e.clientY, ...cropRect };
    document.addEventListener('pointermove', onCropMove);
    document.addEventListener('pointerup', onCropUp);
  }

  handles.forEach(h => {
    const classes = h.className;
    let type = 'tl';
    if (classes.includes('tr')) type = 'tr';
    else if (classes.includes('bl')) type = 'bl';
    else if (classes.includes('br')) type = 'br';
    h.onpointerdown = (e) => onPointerDown(e, type);
  });

  cropBox.onpointerdown = (e) => {
    if (e.target === cropBox) onPointerDown(e, 'move');
  };
}

function onCropMove(e) {
  if (!cropDragging) return;
  const dx = e.clientX - cropStart.x;
  const dy = e.clientY - cropStart.y;

  const canvasRect = editorCanvas.getBoundingClientRect();
  const containerRect = document.getElementById('editor-canvas-container').getBoundingClientRect();
  const minL = canvasRect.left - containerRect.left;
  const minT = canvasRect.top - containerRect.top;
  const maxR = minL + canvasRect.width;
  const maxB = minT + canvasRect.height;

  if (cropDragging === 'move') {
    let l = Math.max(minL, Math.min(maxR - cropStart.width, cropStart.left + dx));
    let t = Math.max(minT, Math.min(maxB - cropStart.height, cropStart.top + dy));
    cropRect.left = l;
    cropRect.top = t;
    cropRect.width = cropStart.width;
    cropRect.height = cropStart.height;
  } else {
    let l = cropRect.left, t = cropRect.top, w = cropRect.width, h = cropRect.height;
    if (cropDragging.includes('l')) {
      l = Math.max(minL, Math.min(cropStart.left + cropStart.width - 40, cropStart.left + dx));
      w = cropStart.left + cropStart.width - l;
    }
    if (cropDragging.includes('r')) {
      w = Math.max(40, Math.min(maxR - cropStart.left, cropStart.width + dx));
    }
    if (cropDragging.includes('t')) {
      t = Math.max(minT, Math.min(cropStart.top + cropStart.height - 40, cropStart.top + dy));
      h = cropStart.top + cropStart.height - t;
    }
    if (cropDragging.includes('b')) {
      h = Math.max(40, Math.min(maxB - cropStart.top, cropStart.height + dy));
    }

    // Apply ratio constraint
    if (cropRatio !== 'free') {
      const [rw, rh] = cropRatio.split(':').map(Number);
      const targetRatio = rw / rh;
      if (cropDragging.includes('l') || cropDragging.includes('r')) {
        h = w / targetRatio;
      } else {
        w = h * targetRatio;
      }
    }

    cropRect = { left: l, top: t, width: w, height: h };
  }
  updateCropBox();
}

function onCropUp() {
  cropDragging = null;
  document.removeEventListener('pointermove', onCropMove);
  document.removeEventListener('pointerup', onCropUp);
}

// Crop ratio buttons
document.querySelectorAll('.ratio-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ratio-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    cropRatio = btn.dataset.ratio;
  });
});

document.getElementById('btn-crop-cancel').addEventListener('click', () => {
  deactivateTool();
});

document.getElementById('btn-crop-apply').addEventListener('click', () => {
  applyCrop();
  deactivateTool();
});

function applyCrop() {
  const canvasRect = editorCanvas.getBoundingClientRect();
  const containerRect = document.getElementById('editor-canvas-container').getBoundingClientRect();
  const offsetL = canvasRect.left - containerRect.left;
  const offsetT = canvasRect.top - containerRect.top;

  // Convert crop box from screen coords to canvas pixel coords
  const scaleX = editorCanvas.width / canvasRect.width;
  const scaleY = editorCanvas.height / canvasRect.height;

  const sx = (cropRect.left - offsetL) * scaleX;
  const sy = (cropRect.top - offsetT) * scaleY;
  const sw = cropRect.width * scaleX;
  const sh = cropRect.height * scaleY;

  // Get the cropped image data
  const croppedData = ctx.getImageData(
    Math.max(0, Math.round(sx)),
    Math.max(0, Math.round(sy)),
    Math.min(editorCanvas.width, Math.round(sw)),
    Math.min(editorCanvas.height, Math.round(sh))
  );

  // Resize canvas
  editorCanvas.width = croppedData.width;
  editorCanvas.height = croppedData.height;
  ctx.putImageData(croppedData, 0, 0);
  baseImage = croppedData;

  // Clear stickers and paths (they won't align after crop)
  stickerLayer.innerHTML = '';
  drawPaths = [];

  // Create new originalImage from cropped result
  const tmpImg = new Image();
  tmpImg.onload = () => {
    originalImage = tmpImg;
    positionStickerLayer();
  };
  tmpImg.src = editorCanvas.toDataURL();

  positionStickerLayer();
  showToast('Cropped', true);
}

// ===== Save =====
btnSave.addEventListener('click', saveImage);

function saveImage() {
  // Flatten stickers onto canvas
  const exportCanvas = document.createElement('canvas');
  exportCanvas.width = editorCanvas.width;
  exportCanvas.height = editorCanvas.height;
  const expCtx = exportCanvas.getContext('2d');

  // Draw the current canvas content (image + filter + drawings)
  expCtx.drawImage(editorCanvas, 0, 0);

  // Draw stickers using html2canvas-like approach for accurate rendering
  const stickers = stickerLayer.querySelectorAll('.sticker');
  if (stickers.length > 0) {
    const layerRect = stickerLayer.getBoundingClientRect();
    const scaleX = editorCanvas.width / layerRect.width;
    const scaleY = editorCanvas.height / layerRect.height;

    stickers.forEach(sticker => {
      const rect = sticker.getBoundingClientRect();
      const cx = (rect.left + rect.width / 2 - layerRect.left) * scaleX;
      const cy = (rect.top + rect.height / 2 - layerRect.top) * scaleY;
      const scale = sticker._scale || 1;
      const text = sticker.childNodes[0].textContent;

      expCtx.save();
      expCtx.translate(cx, cy);

      if (sticker.classList.contains('emoji')) {
        // Use actual rendered size for accurate export
        const renderedW = rect.width / scale;
        const fontSize = 52 * scaleX * scale;
        expCtx.font = `${fontSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
        expCtx.textAlign = 'center';
        expCtx.textBaseline = 'middle';
        expCtx.fillText(text, 0, fontSize * 0.04); // slight offset for vertical centering
      } else if (sticker.classList.contains('text-sticker')) {
        const baseFontSize = sticker._fontSize || 28;
        const fontSize = baseFontSize * scaleX * scale;
        const style = sticker._textStyle || 'blur';
        const color = sticker._textColor || '#FFFFFF';
        const padding = 18 * scaleX * scale;
        const radius = 12 * scaleX * scale;

        expCtx.font = `800 ${fontSize}px -apple-system, BlinkMacSystemFont, "SF Pro Display", system-ui, sans-serif`;
        expCtx.textAlign = 'center';
        expCtx.textBaseline = 'middle';

        const metrics = expCtx.measureText(text);
        const textW = metrics.width;
        const textH = fontSize * 1.15;

        if (style === 'solid') {
          // Solid colored background
          expCtx.fillStyle = color;
          roundRect(expCtx, -textW / 2 - padding, -textH / 2 - padding * 0.5, textW + padding * 2, textH + padding, radius);
          expCtx.fill();
          expCtx.fillStyle = isLightColor(color) ? '#000' : '#fff';
        } else if (style === 'blur') {
          // Semi-transparent dark background (blur can't be done in canvas)
          expCtx.fillStyle = 'rgba(0, 0, 0, 0.35)';
          roundRect(expCtx, -textW / 2 - padding, -textH / 2 - padding * 0.5, textW + padding * 2, textH + padding, radius);
          expCtx.fill();
          expCtx.fillStyle = color;
        } else {
          // Plain — just text with shadow
          expCtx.fillStyle = color;
          expCtx.shadowColor = 'rgba(0,0,0,0.6)';
          expCtx.shadowBlur = 8 * scale * scaleX;
          expCtx.shadowOffsetY = 2 * scale * scaleX;
        }

        expCtx.fillText(text, 0, fontSize * 0.04);
      }

      expCtx.restore();
    });
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Save flash effect (like iOS screenshot)
  const flash = document.createElement('div');
  flash.className = 'save-flash';
  document.body.appendChild(flash);
  setTimeout(() => flash.remove(), 400);

  // Download
  exportCanvas.toBlob((blob) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `snap-edit-${Date.now()}.jpg`;
    a.click();
    URL.revokeObjectURL(url);
    showToast('Saved to Downloads', true);
  }, 'image/jpeg', 0.92);
}

// ===== Toast =====
function showToast(msg, withCheck = false) {
  if (withCheck) {
    toast.innerHTML = `<span class="toast-icon"><svg viewBox="0 0 24 24" fill="none" stroke="#30D158" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg><span>${msg}</span></span>`;
  } else {
    toast.textContent = msg;
  }
  toast.classList.remove('hidden');
  toast.classList.add('show');
  setTimeout(() => {
    toast.classList.remove('show');
    setTimeout(() => toast.classList.add('hidden'), 300);
  }, 1500);
}

// ===== Window Resize =====
window.addEventListener('resize', () => {
  if (editorScreen.classList.contains('active')) {
    positionStickerLayer();
  }
});

// ===== Init =====
startCamera();
