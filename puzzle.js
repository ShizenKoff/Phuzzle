// =========================================
// CAR N O V A puzzle gallery core
// =========================================

// Photo set hosted in assets/photos
const PHOTO_LIST = [
  'assets/images/grace_01.jpg',
  'assets/images/grace_02.jpg',
  'assets/images/grace_03.jpg',
  'assets/images/grace_04.jpg',
  'assets/images/grace_05.jpg',
  'assets/images/grace_06.jpg',
  'assets/images/grace_07.jpg',
  'assets/images/grace_08.jpg',
  'assets/images/grace_09.jpg',
  'assets/images/grace_10.jpg',
  'assets/images/carson_01.jpg',
  'assets/images/carson_02.jpg',
  'assets/images/carson_03.jpg',
  'assets/images/carson_04.jpg',
  'assets/images/carson_05.jpg',
  'assets/images/carson_06.jpg',
  'assets/images/carson_07.jpg',
  'assets/images/carson_08.jpg',
  'assets/images/carson_09.jpg',
  'assets/images/carson_10.jpg',
  'assets/images/carson_11.jpg',
  'assets/images/carson_12.jpg',
  'assets/images/carson_13.jpg',
  'assets/images/carson_14.jpg',
  // add more as you like
];




let currentPhotoIndex = 0;

// debug overlay
const SHOW_IDS = false;

// DOM
const canvas = document.getElementById('puzzleCanvas');
const ctx = canvas.getContext('2d');

const difficultySelect = document.getElementById('difficulty');
const btnPrev = document.getElementById('btnPrev');
const btnNext = document.getElementById('btnNext');
const btnRandom = document.getElementById('btnRandom');
const btnNew = document.getElementById('btnNew');
const btnPause = document.getElementById('btnPause');

const hudTimer = document.getElementById('hud-timer');
const hudMoves = document.getElementById('hud-moves');

const helpSlider = document.getElementById('helpSlider');
const helpValue = document.getElementById('helpValue');

const thumbCanvas = document.getElementById('thumbCanvas');
const thumbCtx = thumbCanvas ? thumbCanvas.getContext('2d') : null;

const ddDropdown = document.getElementById('difficultyDropdown');
const ddMenu = document.getElementById('difficultyMenu');
const ddTrigger = ddDropdown ? ddDropdown.querySelector('.dd-trigger') : null;
const ddLabel = document.getElementById('difficultyLabel');

let ddOpen = false;

function setDifficulty(value) {
  // update hidden select
  if (difficultySelect) {
    difficultySelect.value = value;
  }

  const [r, c] = value.split('x').map(Number);
  rows = r;
  cols = c;
  if (imgLoaded) buildPuzzle();

  // update label text
  ddLabel.textContent = value.replace('x', ' × ');

  // update active state in menu
  ddMenu.querySelectorAll('button').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.value === value);
  });
}

if (ddDropdown && ddMenu && ddTrigger && ddLabel) {

  ddTrigger.addEventListener('click', (e) => {
    e.preventDefault();
    ddDropdown.classList.toggle('open');
  });

  ddMenu.querySelectorAll('button').forEach(btn => {
    btn.addEventListener('click', () => {
      const value = btn.dataset.value;
      if (!value) return;

      // update label
      ddLabel.textContent = value.replace('x', ' × ');

      // update hidden select
      if (difficultySelect) {
        difficultySelect.value = value;
      }

      // visual active state
      ddMenu.querySelectorAll('button').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      ddDropdown.classList.remove('open');

      // rebuild puzzle safely
      if (imgLoaded) buildPuzzle();
    });
  });

}



// puzzle rect (dynamic)
const MAX_PUZZLE_SIZE = 1200;
let puzzleW = 600;
let puzzleH = 600;
let puzzleX = (canvas.width - puzzleW) / 2;
let puzzleY = (canvas.height - puzzleH) / 2;
let tileW = 0;
let tileH = 0;

// image + puzzle state
const img = new Image();
let imgLoaded = false;
let rows = 4;
let cols = 4;

// pieces:
// { id, correctRow, correctCol, row, col, x, y, width, height }
let pieces = [];

// drag state (cluster drag)
let draggingPiece = null;
let dragCluster = null;       // array of pieces in this move
let dragPointerStart = null;  // {x, y}
let dragClusterStates = [];   // [{ piece, startRow, startCol, startX, startY }]
let moveCount = 0;

// timing
let solvedFlag = false;
let solvedTimeSeconds = 0;
let newRecordFlag = false;

// timer control
let timerActive = false;   // starts on first grab
let paused = false;        // pause state

// time accumulation with help penalty
let accumulatedElapsed = 0;
let lastTickTime = null;
const HELP_PENALTY_MULT = 2; // at 100 percent help, time runs 3x

// solve animation timing
let solveAnimationStart = 0;

// best time storage
const STORAGE_KEY = 'car_nova_puzzle_best_v1';
let bestRecords = loadBestRecords();

// shape library – stage 1
// 'rect' = current behavior, 'wave' = wavy puzzle-like edges
let shapeMode = 'wave'; // try 'wave' for now; you can swap back to 'rect'


// Audio state
let audioEnabled = true;          // default on
let audioUnlocked = false;        // flips true once browser lets us play
let bgmAudio = null;
let btnMuteAudio = null;

let canvasCssW = 0;
let canvasCssH = 0;


const AUDIO_STORAGE_KEY = 'photoPuzzle_audioEnabled';

// ---------------------------------------
// Update mute button UI
// ---------------------------------------
function updateAudioUi() {
  if (!btnMuteAudio) return;
  btnMuteAudio.textContent = audioEnabled ? '🔊' : '🔇';
}

// ---------------------------------------
// Toggle audio on/off
// ---------------------------------------
function toggleAudioMute() {
  audioEnabled = !audioEnabled;

  // Persist preference
  try {
    localStorage.setItem(AUDIO_STORAGE_KEY, audioEnabled ? '1' : '0');
  } catch (e) {}

  // Apply to audio element
  if (bgmAudio) {
    bgmAudio.muted = !audioEnabled;
  }

  updateAudioUi();
}

// ---------------------------------------
// Init audio: call once after DOM is ready
// ---------------------------------------
function initAudio() {
  bgmAudio = document.getElementById('puzzleBgm');
  btnMuteAudio = document.getElementById('btnMuteAudio');

  // Load previous preference if stored
  try {
    const stored = localStorage.getItem(AUDIO_STORAGE_KEY);
    if (stored === '0') {
      audioEnabled = false;
    }
  } catch (e) {}

  if (bgmAudio) {
    // Start in muted/unmuted state but don't force play yet;
    // actual playback happens in setupAudioUnlock on user gesture.
    bgmAudio.muted = !audioEnabled;
  }

  if (btnMuteAudio && !btnMuteAudio._puzzleBound) {
    btnMuteAudio.addEventListener('click', toggleAudioMute);
    btnMuteAudio._puzzleBound = true; // avoid double-binding on reload
  }

  updateAudioUi();
}

// ---------------------------------------
// Browser audio unlock for autoplay rules
// ---------------------------------------
function setupAudioUnlock() {
  function unlockHandler() {
    if (audioUnlocked) return;
    audioUnlocked = true;

    if (audioEnabled && bgmAudio) {
      bgmAudio.muted = false;
      bgmAudio.play().catch(() => {
        // ignore failures (e.g., user blocks autoplay)
      });
    }

    // remove listeners once done
    window.removeEventListener('click', unlockHandler);
    window.removeEventListener('keydown', unlockHandler);
    window.removeEventListener('touchstart', unlockHandler);
  }

  window.addEventListener('click', unlockHandler);
  window.addEventListener('keydown', unlockHandler);
  window.addEventListener('touchstart', unlockHandler);
}
// -----------------------------------------------


// =========================================
// localStorage helpers
// =========================================

function loadBestRecords() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (e) {
    console.warn('CAR N O V A puzzle: failed to load best records', e);
    return {};
  }
}

function saveBestRecords() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bestRecords));
  } catch (e) {
    console.warn('CAR N O V A puzzle: failed to save best records', e);
  }
}

function getConfigKey() {
  return `${currentPhotoIndex}-${rows}x${cols}`;
}

function getBestForCurrent() {
  const key = getConfigKey();
  return bestRecords[key] || null;
}

function updateBestIfNeeded(finalTime, finalMoves) {
  const key = getConfigKey();
  const existing = bestRecords[key];

  if (!existing || finalTime < existing.time) {
    bestRecords[key] = { time: finalTime, moves: finalMoves };
    saveBestRecords();
    newRecordFlag = true;
  } else {
    newRecordFlag = false;
  }
}


let uiBound = false;

function bindUiOnce() {
  if (uiBound) return;
  uiBound = true;
  bindUi();
}



// =========================================
// image loading
// =========================================

function loadCurrentPhoto() {
  imgLoaded = false;
  solvedFlag = false;
  newRecordFlag = false;
  img.src = PHOTO_LIST[currentPhotoIndex];
}

img.onload = () => {
  imgLoaded = true;

  bindUiOnce();
  initAudio();
  setupAudioUnlock();

  if (resizeCanvasToCssSize()) {
    buildPuzzle();
    drawThumbnail();
  } else {
    // try again on next frame if mobile layout hasn't settled
    requestAnimationFrame(() => {
      if (resizeCanvasToCssSize()) {
        buildPuzzle();
        drawThumbnail();
      }
    });
  }
};



// =========================================
// controls
// =========================================
function bindButton(el, handler) {
  if (!el || !handler) return;

  // Desktop & most mobile browsers
  el.addEventListener('click', (evt) => {
    evt.preventDefault();
    handler();
  });

  // iOS / touch edge cases inside iframes (Wix)
  el.addEventListener('touchend', (evt) => {
    evt.preventDefault();   // stop ghost-click / scroll
    handler();
  }, { passive: false });
}

// -----------------------------------------
// Bind all UI controls
// -----------------------------------------
function bindUi() {
  // Photos nav
  bindButton(btnPrev, () => {
    currentPhotoIndex =
      (currentPhotoIndex - 1 + PHOTO_LIST.length) % PHOTO_LIST.length;
    loadCurrentPhoto();
  });

  bindButton(btnNext, () => {
    currentPhotoIndex = (currentPhotoIndex + 1) % PHOTO_LIST.length;
    loadCurrentPhoto();
  });

  bindButton(btnRandom, () => {
    currentPhotoIndex = Math.floor(Math.random() * PHOTO_LIST.length);
    loadCurrentPhoto();
  });

  // New puzzle
  bindButton(btnNew, () => {
    if (imgLoaded) buildPuzzle();
  });

  // Pause / resume
  bindButton(btnPause, () => {
    if (!imgLoaded || solvedFlag) return;

    paused = !paused;
    btnPause.textContent = paused ? 'Resume' : 'Pause';

    // when resuming, reset lastTickTime so we don't get a jump
    if (!paused && timerActive) {
      lastTickTime = Date.now();
    }
  });

  // Help slider stays as an input listener (not a button)
  if (helpSlider) {
    helpSlider.addEventListener('input', () => {
      const level = Number(helpSlider.value) / 100;
      helpValue.textContent = `${helpSlider.value}%`;

      if (thumbCanvas) {
        const blur = 6 * (1 - level);
        const brightness = 0.5 + 0.5 * level;
        const opacity = 0.25 + 0.75 * level;
        thumbCanvas.style.filter = `blur(${blur}px) brightness(${brightness})`;
        thumbCanvas.style.opacity = opacity;
      }
    });
  }
}

function resizeCanvasToCssSize() {
  const rect = canvas.getBoundingClientRect();

  // Guard: if Wix/phone hasn't laid it out yet
  if (!rect.width || !rect.height) return false;

  const w = Math.round(rect.width);
  const h = Math.round(rect.height);

  if (canvas.width !== w || canvas.height !== h) {
    canvas.width = w;
    canvas.height = h;
  }

  // Use 1:1 coords so buildPuzzle math matches draw coords
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  return true;
}





// =========================================
// puzzle build
// =========================================

function buildPuzzle() {
  pieces = [];
  moveCount = 0;
  solvedFlag = false;
  newRecordFlag = false;
  solveAnimationStart = 0;

  // reset timing & control
  accumulatedElapsed = 0;
  lastTickTime = null;
  timerActive = false;
  paused = false;
  if (btnPause) btnPause.textContent = 'Pause';

  if (!img) return;

  // ===== dynamic puzzle rect from image aspect =====
  const aspect = img.width / img.height; // w / h
  const isMobile = window.innerWidth < 768;

  // small margin between puzzle and canvas edge
  const EDGE_MARGIN = isMobile ? 0 : 12;

  // usable area inside the canvas
  const usableW = canvasCssW.width  - EDGE_MARGIN * 2;
  const usableH = canvasCssW.height - EDGE_MARGIN * 2;

  let targetW, targetH;

  if (aspect >= 1) {
    // wider images
    targetW = Math.min(usableW, MAX_PUZZLE_SIZE);
    targetH = targetW / aspect;

    // if too tall for usable height, clamp by height instead
    if (targetH > usableH) {
      targetH = usableH;
      targetW = targetH * aspect;
    }
  } else {
    // taller images
    targetH = Math.min(usableH, MAX_PUZZLE_SIZE);
    targetW = targetH * aspect;

    // if too wide for usable width, clamp by width instead
    if (targetW > usableW) {
      targetW = usableW;
      targetH = targetW / aspect;
    }
  }

  // snap to whole tiles
  const tileWInt = Math.floor(targetW / cols);
  const tileHInt = Math.floor(targetH / rows);

  tileW   = tileWInt;
  tileH   = tileHInt;
  puzzleW = tileW * cols;
  puzzleH = tileH * rows;

  // center puzzle in the canvas
  puzzleX = Math.round((canvasCssW.width  - puzzleW) / 2);
  puzzleY = Math.round((canvasCssW.height - puzzleH) / 2);

  // ===== build pieces & slots =====
  let id = 0;
  const slots = [];

  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const correctX = puzzleX + c * tileW;
      const correctY = puzzleY + r * tileH;

      pieces.push({
        id: id++,
        correctRow: r,
        correctCol: c,
        row: r,
        col: c,
        x: correctX,
        y: correctY,
        width: tileW,
        height: tileH
      });

      slots.push({ row: r, col: c });
    }
  }

  // shuffle slots
  for (let i = slots.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [slots[i], slots[j]] = [slots[j], slots[i]];
  }

  // assign shuffled positions
  pieces.forEach((p, idx) => {
    const s = slots[idx];
    p.row = s.row;
    p.col = s.col;
    p.x = puzzleX + p.col * tileW;
    p.y = puzzleY + p.row * tileH;
  });
}


// =========================================
// thumbnail
// =========================================

function drawThumbnail() {
  if (!imgLoaded || !thumbCtx) return;
  const w = thumbCanvas.width;
  const h = thumbCanvas.height;

  thumbCtx.clearRect(0, 0, w, h);

  const aspect = img.width / img.height;
  let drawW = w;
  let drawH = h;

  if (aspect > 1) {
    drawH = w / aspect;
  } else {
    drawW = h * aspect;
  }

  const dx = (w - drawW) / 2;
  const dy = (h - drawH) / 2;

  thumbCtx.drawImage(img, 0, 0, img.width, img.height, dx, dy, drawW, drawH);
}

// =========================================
// helpers: board + linked cluster
// =========================================

function buildBoard() {
  const board = Array.from({ length: rows }, () =>
    Array(cols).fill(null)
  );
  pieces.forEach(p => {
    board[p.row][p.col] = p;
  });
  return board;
}

function getLinkedNeighbors(piece, board) {
  const r = piece.row;
  const c = piece.col;
  const cr = piece.correctRow;
  const cc = piece.correctCol;

  const res = [];

  const top = r > 0 ? board[r - 1][c] : null;
  const bottom = r < rows - 1 ? board[r + 1][c] : null;
  const left = c > 0 ? board[r][c - 1] : null;
  const right = c < cols - 1 ? board[r][c + 1] : null;

  if (top && top.correctRow === cr - 1 && top.correctCol === cc) res.push(top);
  if (bottom && bottom.correctRow === cr + 1 && bottom.correctCol === cc) res.push(bottom);
  if (left && left.correctRow === cr && left.correctCol === cc - 1) res.push(left);
  if (right && right.correctRow === cr && right.correctCol === cc + 1) res.push(right);

  return res;
}

function buildLinkedCluster(startPiece) {
  const board = buildBoard();
  const cluster = [];
  const stack = [startPiece];
  const visited = new Set();
  visited.add(startPiece);

  while (stack.length) {
    const p = stack.pop();
    cluster.push(p);
    const neigh = getLinkedNeighbors(p, board);
    neigh.forEach(n => {
      if (!visited.has(n)) {
        visited.add(n);
        stack.push(n);
      }
    });
  }

  return cluster;
}



// =========================================
// render loop
// =========================================

function draw() {
  const now = Date.now();

  // time with help penalty (only when active and not paused)
  if (timerActive && !solvedFlag && !paused) {
    if (lastTickTime == null) {
      lastTickTime = now;
    } else {
      const dt = (now - lastTickTime) / 1000;
      lastTickTime = now;

      const helpLevel = Number(helpSlider.value) / 100;
      const factor = 1 + helpLevel * HELP_PENALTY_MULT;
      accumulatedElapsed += dt * factor;
    }
  } else {
    // keep this synced so we don't get a big jump when resuming / starting
    lastTickTime = now;
  }

  // clear whole canvas
  ctx.clearRect(0, 0, canvasCssW.width, canvasCssW.height);

  // base neon border
  drawPuzzleBorderBase();

  // loading state
  if (!imgLoaded) {
    ctx.fillStyle = '#d8c0ff';
    ctx.textAlign = 'center';
    ctx.font = '20px system-ui';
    ctx.fillText('Loading photo', canvasCssW.width / 2, canvasCssW.height / 2);
    requestAnimationFrame(draw);
    return;
  }

  // source tile sizes
  const srcTileW = img.width / cols;
  const srcTileH = img.height / rows;

  // board for neighbor lookups
  const board = buildBoard();

  // draw pieces
  pieces.forEach(p => {
    // snap non-dragging pieces to their grid slot
    if (!dragCluster || !dragCluster.includes(p)) {
      p.x = puzzleX + p.col * tileW;
      p.y = puzzleY + p.row * tileH;
    }

    const sx = p.correctCol * srcTileW;
    const sy = p.correctRow * srcTileH;

    // shape library hook – use buildPiecePath if it exists
    let usedShape = false;
    if (typeof buildPiecePath === 'function') {
      const path = buildPiecePath(p);
      if (path) {
        usedShape = true;
        ctx.save();
        ctx.clip(path);
        ctx.drawImage(
          img,
          sx,
          sy,
          srcTileW,
          srcTileH,
          p.x,
          p.y,
          p.width,
          p.height
        );
        ctx.restore();
      }
    }

    if (!usedShape) {
      // fallback: classic rectangle
      ctx.drawImage(
        img,
        sx,
        sy,
        srcTileW,
        srcTileH,
        p.x,
        p.y,
        p.width,
        p.height
      );
    }

    // outline / link borders (your existing logic)
    if (!solvedFlag) {
  drawPieceBorder(p, board);
}

  });

  // solved check
  const nowSolved = checkSolved();
  if (nowSolved && !solvedFlag) {
    solvedFlag = true;
    solvedTimeSeconds = accumulatedElapsed;
    solveAnimationStart = now;
    updateBestIfNeeded(solvedTimeSeconds, moveCount);
  }

  // HUD update
  const elapsed = solvedFlag ? solvedTimeSeconds : accumulatedElapsed;
  const best = getBestForCurrent();
  const bestText = best ? `${best.time.toFixed(1)}s` : '-';

  hudTimer.textContent = `Time: ${elapsed.toFixed(1)}s`;
  hudMoves.textContent = `Moves: ${moveCount}   |   Best: ${bestText}`;

  // solve border effect + overlay
  if (solvedFlag && solveAnimationStart) {
    drawSolveBorderEffect();
  }

  if (solvedFlag) {
    drawVictoryOverlay();
  }

  // fuzzy pause overlay (after everything else, but not if solved)
  if (paused && !solvedFlag) {
    drawPauseOverlay();
  }

  requestAnimationFrame(draw);
}

  

// =========================================
// borders and effects
// =========================================

function drawPuzzleBorderBase() {
  const offset = 1.5; // half the line width

  ctx.save();
  ctx.lineWidth = 3;
  ctx.strokeStyle = '#ffb3e6';
  ctx.shadowColor = '#b5fff6';
  ctx.shadowBlur = 20;

  // draw the border fully *outside* the image area
  ctx.strokeRect(
    puzzleX - offset,
    puzzleY - offset,
    puzzleW + offset * 2,
    puzzleH + offset * 2
  );

  ctx.restore();
}


function drawPieceBorder(p, board) {
  const x = p.x;
  const y = p.y;
  const w = p.width;
  const h = p.height;

  const r = p.row;
  const c = p.col;
  const cr = p.correctRow;
  const cc = p.correctCol;

  const topP = r > 0 ? board[r - 1][c] : null;
  const bottomP = r < rows - 1 ? board[r + 1][c] : null;
  const leftP = c > 0 ? board[r][c - 1] : null;
  const rightP = c < cols - 1 ? board[r][c + 1] : null;

  const topLinked = !!topP && topP.correctRow === cr - 1 && topP.correctCol === cc;
  const bottomLinked = !!bottomP && bottomP.correctRow === cr + 1 && bottomP.correctCol === cc;
  const leftLinked = !!leftP && leftP.correctRow === cr && leftP.correctCol === cc - 1;
  const rightLinked = !!rightP && rightP.correctRow === cr && rightP.correctCol === cc + 1;

  const hasLinkedNeighbor = topLinked || bottomLinked || leftLinked || rightLinked;

  ctx.save();
  ctx.lineWidth = hasLinkedNeighbor ? 2 : 3;
  ctx.strokeStyle = hasLinkedNeighbor
    ? 'rgba(255,255,255,0.35)'
    : 'rgba(255,179,230,0.9)';

  ctx.beginPath();
  if (!topLinked) {
    ctx.moveTo(x, y);
    ctx.lineTo(x + w, y);
  }
  if (!rightLinked) {
    ctx.moveTo(x + w, y);
    ctx.lineTo(x + w, y + h);
  }
  if (!bottomLinked) {
    ctx.moveTo(x + w, y + h);
    ctx.lineTo(x, y + h);
  }
  if (!leftLinked) {
    ctx.moveTo(x, y + h);
    ctx.lineTo(x, y);
  }
  ctx.stroke();
  ctx.restore();

  if (SHOW_IDS) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(x, y, 22, 16);
    ctx.fillStyle = '#fff';
    ctx.font = '10px system-ui';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(p.id.toString(), x + 3, y + 2);
    ctx.restore();
  }
}

// ===============================
// SHAPE LIBRARY – STAGE 1
// ===============================

function buildPiecePathRect(p) {
  const path = new Path2D();
  path.rect(p.x, p.y, p.width, p.height);
  return path;
}

// Wavy "puzzle-ish" shape that still fits in the tile box.
// No tabs/holes yet, just nice curved edges that line up between neighbors.
function buildPiecePathWave(p) {
  const x = p.x;
  const y = p.y;
  const w = p.width;
  const h = p.height;

  const path = new Path2D();
  const amp = Math.min(w, h) * 0.12;   // bump size
  const qx1 = x + w * 0.25;
  const qx2 = x + w * 0.5;
  const qx3 = x + w * 0.75;

  const qy1 = y + h * 0.25;
  const qy2 = y + h * 0.5;
  const qy3 = y + h * 0.75;

  // Start at top-left corner
  path.moveTo(x, y);

  // Top edge: left -> right, one bump upward
  path.lineTo(qx1, y);
  path.quadraticCurveTo(qx2, y - amp, qx3, y);
  path.lineTo(x + w, y);

  // Right edge: top -> bottom, one bump rightwards
  path.lineTo(x + w, qy1);
  path.quadraticCurveTo(x + w + amp, qy2, x + w, qy3);
  path.lineTo(x + w, y + h);

  // Bottom edge: right -> left, one bump downward
  path.lineTo(qx3, y + h);
  path.quadraticCurveTo(qx2, y + h + amp, qx1, y + h);
  path.lineTo(x, y + h);

  // Left edge: bottom -> top, one bump leftwards
  path.lineTo(x, qy3);
  path.quadraticCurveTo(x - amp, qy2, x, qy1);
  path.lineTo(x, y);

  path.closePath();
  return path;
}

function buildPiecePath(p) {
  if (shapeMode === 'wave') {
    return buildPiecePathWave(p);
  }
  // default / fallback
  return buildPiecePathRect(p);
}



function drawSolveBorderEffect() {
  const t = Date.now() - solveAnimationStart;

  const LAPS = 3;
  const LAP_DURATION = 600;
  const TOTAL_LAP_TIME = LAPS * LAP_DURATION;
  const FLASH_DURATION = 350;

  const perimeter = 2 * (puzzleW + puzzleH);
  const dashLength = Math.min(puzzleW, puzzleH) / 6;

  if (t <= TOTAL_LAP_TIME) {
    const progress = t / LAP_DURATION;
    const offset = -(progress * perimeter);

    ctx.save();
    ctx.lineWidth = 5;
    ctx.strokeStyle = '#b5fff6';
    ctx.setLineDash([dashLength, dashLength]);
    ctx.lineDashOffset = offset;
    ctx.shadowColor = '#b5fff6';
    ctx.shadowBlur = 18;
    ctx.strokeRect(puzzleX, puzzleY, puzzleW, puzzleH);
    ctx.restore();
  }

  if (t > TOTAL_LAP_TIME && t <= TOTAL_LAP_TIME + FLASH_DURATION) {
    const flashProgress = (t - TOTAL_LAP_TIME) / FLASH_DURATION;
    const intensity = 1 - Math.pow(1 - flashProgress, 2);

    ctx.save();
    ctx.lineWidth = 6;
    ctx.strokeStyle = '#ffffff';
    ctx.shadowColor = '#ffb3e6';
    ctx.shadowBlur = 32 * intensity + 8;
    ctx.globalAlpha = 0.6 + 0.4 * (1 - flashProgress);
    ctx.strokeRect(puzzleX, puzzleY, puzzleW, puzzleH);
    ctx.restore();
  }

  ctx.setLineDash([]);
}

function drawPauseOverlay() {
  ctx.save();

  // frosted glass overlay on puzzle area
  const gradient = ctx.createLinearGradient(
    puzzleX,
    puzzleY,
    puzzleX + puzzleW,
    puzzleY + puzzleH
  );
  gradient.addColorStop(0, 'rgba(10, 5, 25, 0.85)');
  gradient.addColorStop(0.5, 'rgba(20, 10, 40, 0.9)');
  gradient.addColorStop(1, 'rgba(5, 5, 15, 0.9)');

  ctx.fillStyle = gradient;
  ctx.fillRect(puzzleX, puzzleY, puzzleW, puzzleH);

  // subtle cross-hatch lines to "fuzz" details
  ctx.strokeStyle = 'rgba(255, 179, 230, 0.14)';
  ctx.lineWidth = 1;
  const step = 16;
  for (let x = puzzleX; x < puzzleX + puzzleW + puzzleH; x += step) {
    ctx.beginPath();
    ctx.moveTo(x, puzzleY);
    ctx.lineTo(x - puzzleH, puzzleY + puzzleH);
    ctx.stroke();
  }

  // PAUSED text
  ctx.textAlign = 'center';
  ctx.fillStyle = '#ffb3e6';
  ctx.font = '24px system-ui';
  ctx.fillText(
    'Paused',
    canvas.width / 2,
    canvas.height / 2 - 8
  );

  ctx.font = '13px system-ui';
  ctx.fillStyle = '#b5fff6';
  ctx.fillText(
    'Tap Resume to continue',
    canvas.width / 2,
    canvas.height / 2 + 14
  );

  ctx.restore();
}


// =========================================
// victory overlay
// =========================================

function checkSolved() {
  return (
    pieces.length > 0 &&
    pieces.every(p => p.row === p.correctRow && p.col === p.correctCol)
  );
}

function drawVictoryOverlay() {
  const elapsed = solvedTimeSeconds.toFixed(1);
  const best = getBestForCurrent();

  ctx.save();
  ctx.fillStyle = 'rgba(0, 0, 0, 0.45)';
  ctx.fillRect(puzzleX, puzzleY, puzzleW, puzzleH);

  ctx.textAlign = 'center';
  ctx.font = '28px system-ui';
  ctx.fillStyle = '#b5fff6';
  ctx.fillText(
    'Puzzle complete',
    canvas.width / 2,
    canvas.height / 2 - 22
  );

  ctx.font = '16px system-ui';
  ctx.fillStyle = '#ffb3e6';
  ctx.fillText(
    `${moveCount} moves - ${elapsed}s`,
    canvas.width / 2,
    canvas.height / 2 + 4
  );

  ctx.font = '14px system-ui';
  const bestLine = best
    ? `Best: ${best.time.toFixed(1)}s (${best.moves} moves)`
    : 'No record yet';
  ctx.fillStyle = newRecordFlag ? '#fffd7a' : '#ffd8ff';
  const extra = newRecordFlag ? ' - New record!' : '';
  ctx.fillText(
    bestLine + extra,
    canvas.width / 2,
    canvas.height / 2 + 28
  );

  ctx.restore();
}

// =========================================
// input handling: cluster drag + swap
// =========================================

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  return {
    x: (evt.clientX - rect.left),
    y: (evt.clientY - rect.top)
  };
}


function startDrag(evt) {
  if (!imgLoaded) return;
  if (paused) {
    if (evt.touches) evt.preventDefault();
    return;
  }

  // start timer on first interaction
  if (!timerActive && !solvedFlag) {
    timerActive = true;
    lastTickTime = Date.now();
  }

  const pos = evt.touches
    ? getPointerPos(evt.touches[0])
    : getPointerPos(evt);

  draggingPiece = null;
  dragCluster = null;
  dragClusterStates = [];
  dragPointerStart = null;

  // pick top piece
  for (let i = pieces.length - 1; i >= 0; i--) {
    const p = pieces[i];
    if (
      pos.x >= p.x &&
      pos.x <= p.x + p.width &&
      pos.y >= p.y &&
      pos.y <= p.y + p.height
    ) {
      draggingPiece = p;
      break;
    }
  }

  if (!draggingPiece) {
    if (evt.touches) evt.preventDefault();
    return;
  }

  // build linked cluster from that piece
  const cluster = buildLinkedCluster(draggingPiece);

  // if the whole cluster is already in correct spots, do not drag
  const clusterComplete = cluster.every(
    pc => pc.row === pc.correctRow && pc.col === pc.correctCol
  );
  if (clusterComplete) {
    draggingPiece = null;
    if (evt.touches) evt.preventDefault();
    return;
  }

  dragCluster = cluster;
  dragPointerStart = pos;
  dragClusterStates = cluster.map(pc => ({
    piece: pc,
    startRow: pc.row,
    startCol: pc.col,
    startX: pc.x,
    startY: pc.y
  }));

  // bring cluster to front
  dragCluster.forEach(pc => {
    const idx = pieces.indexOf(pc);
    if (idx >= 0) {
      pieces.splice(idx, 1);
      pieces.push(pc);
    }
  });

  if (evt.touches) evt.preventDefault();
}

function drag(evt) {
  if (paused) {
    if (evt.touches) evt.preventDefault();
    return;
  }
  if (!dragCluster || !dragPointerStart) return;

  const pos = evt.touches
    ? getPointerPos(evt.touches[0])
    : getPointerPos(evt);

  const dx = pos.x - dragPointerStart.x;
  const dy = pos.y - dragPointerStart.y;

  dragClusterStates.forEach(s => {
    s.piece.x = s.startX + dx;
    s.piece.y = s.startY + dy;
  });

  if (evt.touches) evt.preventDefault();
}

function endDrag(evt) {
  if (paused) {
    if (evt && evt.touches) evt.preventDefault();
    return;
  }
  if (!dragCluster || dragClusterStates.length === 0) {
    dragCluster = null;
    draggingPiece = null;
    dragClusterStates = [];
    dragPointerStart = null;
    if (evt && evt.touches) evt.preventDefault();
    return;
  }

  const baseState =
    dragClusterStates.find(s => s.piece === draggingPiece) ||
    dragClusterStates[0];

  const basePiece = baseState.piece;
  const centerX = basePiece.x + basePiece.width / 2;
  const centerY = basePiece.y + basePiece.height / 2;

  let targetCol = Math.floor((centerX - puzzleX) / tileW);
  let targetRow = Math.floor((centerY - puzzleY) / tileH);

  // offsets inside the cluster
  let minRowOffset = Infinity;
  let maxRowOffset = -Infinity;
  let minColOffset = Infinity;
  let maxColOffset = -Infinity;

  dragClusterStates.forEach(s => {
    const rowOffset = s.startRow - baseState.startRow;
    const colOffset = s.startCol - baseState.startCol;
    if (rowOffset < minRowOffset) minRowOffset = rowOffset;
    if (rowOffset > maxRowOffset) maxRowOffset = rowOffset;
    if (colOffset < minColOffset) minColOffset = colOffset;
    if (colOffset > maxColOffset) maxColOffset = colOffset;
  });

  // clamp base so whole cluster stays on board
  const minRowAllowed = 0 - minRowOffset;
  const maxRowAllowed = rows - 1 - maxRowOffset;
  const minColAllowed = 0 - minColOffset;
  const maxColAllowed = cols - 1 - maxColOffset;

  targetRow = Math.max(minRowAllowed, Math.min(maxRowAllowed, targetRow));
  targetCol = Math.max(minColAllowed, Math.min(maxColAllowed, targetCol));

  const clusterSet = new Set(dragCluster.map(p => p));

  // old board layout
  const oldBoard = buildBoard();

  // new board layout (we’ll rebuild everything here)
  const newBoard = Array.from({ length: rows }, () =>
    Array(cols).fill(null)
  );

  const destCellsSet = new Set();
  const srcCellsSet = new Set();
  const displacedPieces = [];

  function keyOf(r, c) {
    return `${r},${c}`;
  }

  // 1) place cluster in its new destination cells
  dragClusterStates.forEach(s => {
    const rowOffset = s.startRow - baseState.startRow;
    const colOffset = s.startCol - baseState.startCol;

    const destRow = targetRow + rowOffset;
    const destCol = targetCol + colOffset;

    const piece = s.piece;

    piece.row = destRow;
    piece.col = destCol;

    newBoard[destRow][destCol] = piece;

    destCellsSet.add(keyOf(destRow, destCol));
    srcCellsSet.add(keyOf(s.startRow, s.startCol));
  });

  // 2) walk old board for non-cluster pieces
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const piece = oldBoard[r][c];
      if (!piece || clusterSet.has(piece)) continue;

      const k = keyOf(r, c);

      if (!destCellsSet.has(k)) {
        // not being taken over by cluster
        if (!newBoard[r][c]) {
          newBoard[r][c] = piece;
          piece.row = r;
          piece.col = c;
        } else {
          // very rare safety case: cell already occupied in newBoard
          displacedPieces.push(piece);
        }
      } else {
        // this piece is in a destination cell that cluster is moving into
        displacedPieces.push(piece);
      }
    }
  }

  // 3) find "holes": cluster source cells that are NOT destination cells
  const holes = [];
  srcCellsSet.forEach(k => {
    if (!destCellsSet.has(k)) {
      const [rStr, cStr] = k.split(',');
      holes.push({ row: parseInt(rStr, 10), col: parseInt(cStr, 10) });
    }
  });

  // 4) move displaced pieces into these holes
  // (in your 3-of-4 case, this sends the single into the one free slot)
  if (holes.length >= displacedPieces.length) {
    for (let i = 0; i < displacedPieces.length; i++) {
      const piece = displacedPieces[i];
      const hole = holes[i];

      newBoard[hole.row][hole.col] = piece;
      piece.row = hole.row;
      piece.col = hole.col;
    }
  } else {
    // fallback: if something weird ever happens, just snap displaced pieces
    // back to their old row/col (keeps board sane)
    displacedPieces.forEach(piece => {
      // we can extract their position from oldBoard scan if needed,
      // but in normal gameplay we shouldn't hit this path.
    });
  }

  moveCount++;

  dragCluster = null;
  draggingPiece = null;
  dragClusterStates = [];
  dragPointerStart = null;

  if (evt && evt.touches) evt.preventDefault();
}


// mouse + touch
canvas.addEventListener('mousedown', startDrag, false);
canvas.addEventListener('mousemove', drag, false);
window.addEventListener('mouseup', endDrag, false);

canvas.addEventListener('touchstart', startDrag, { passive: false });
canvas.addEventListener('touchmove', drag, { passive: false });
window.addEventListener('touchend', endDrag, { passive: false });

// Pointer events (covers many mobile browsers cleanly)
canvas.addEventListener('pointerdown', startDrag, false);
canvas.addEventListener('pointermove', drag, false);
window.addEventListener('pointerup', endDrag, false);


// =========================================
// boot
// =========================================

helpValue.textContent = `${helpSlider.value}%`;
if (helpSlider) {
  helpSlider.dispatchEvent(new Event('input'));
}
loadCurrentPhoto();
setDifficulty('4x4');
draw();