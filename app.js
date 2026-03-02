// ── Canvas setup ──────────────────────────────────────────────────────────────
const canvas = document.getElementById('bfs-canvas');
const ctx = canvas.getContext('2d');
const CANVAS_H = 560;
const NODE_R = 7;

// ── Load background map image ─────────────────────────────────────────────────
const mapImage = new Image();
mapImage.src = 'india_bg.png';
mapImage.onload = () => drawMap();

// ── State positions (image-fraction coords) ───────────────────────────────────
const stateNames = Object.keys(STATE_DATA);

function getW() { return canvas.offsetWidth || 740; }

// Convert image-fraction (fx,fy) → world (canvas) coordinates
function statePos(name) {
  const d = STATE_DATA[name];
  const W = getW();
  return { x: d.fx * W, y: d.fy * CANVAS_H };
}

function initCanvas() {
  const W = getW();
  canvas.width = W * window.devicePixelRatio;
  canvas.height = CANVAS_H * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  canvas.style.height = CANVAS_H + 'px';
}

// ── Build adjacency list ──────────────────────────────────────────────────────
const graph = {};
stateNames.forEach(s => { graph[s] = []; });
STATE_EDGES.forEach(([a, b]) => {
  if (!graph[a].includes(b)) graph[a].push(b);
  if (!graph[b].includes(a)) graph[b].push(a);
});

// ── Zoom / Pan ────────────────────────────────────────────────────────────────
let zoom = 1.0, panX = 0, panY = 0;
let isDrag = false, dSX = 0, dSY = 0;
const ZMIN = 0.7, ZMAX = 8, ZSTEP = 1.25;

function clampPan() {
  const W = getW(), m = 80;
  panX = Math.max(-(W * zoom - m), Math.min(W - m, panX));
  panY = Math.max(-(CANVAS_H * zoom - m), Math.min(CANVAS_H - m, panY));
}
function zoomAt(x, y, f) {
  const nz = Math.max(ZMIN, Math.min(ZMAX, zoom * f));
  panX = x - (x - panX) * (nz / zoom);
  panY = y - (y - panY) * (nz / zoom);
  zoom = nz; clampPan(); drawMap();
}
function resetView() { zoom = 1; panX = 0; panY = 0; drawMap(); }

canvas.addEventListener('wheel', e => {
  e.preventDefault();
  const r = canvas.getBoundingClientRect();
  zoomAt(e.clientX - r.left, e.clientY - r.top, e.deltaY < 0 ? ZSTEP : 1 / ZSTEP);
}, { passive: false });
canvas.addEventListener('mousedown', e => {
  isDrag = true; dSX = e.clientX - panX; dSY = e.clientY - panY;
  canvas.style.cursor = 'grabbing';
});
canvas.addEventListener('mousemove', e => {
  if (!isDrag) return;
  panX = e.clientX - dSX; panY = e.clientY - dSY;
  clampPan(); drawMap();
});
canvas.addEventListener('mouseup', () => { isDrag = false; canvas.style.cursor = 'grab'; });
canvas.addEventListener('mouseleave', () => { isDrag = false; canvas.style.cursor = 'grab'; });

// Touch
let lDist = 0, lMX = 0, lMY = 0, tPan = false;
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const r = canvas.getBoundingClientRect();
    lDist = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    lMX = (e.touches[0].clientX + e.touches[1].clientX) / 2 - r.left;
    lMY = (e.touches[0].clientY + e.touches[1].clientY) / 2 - r.top;
    tPan = false;
  } else { tPan = true; dSX = e.touches[0].clientX - panX; dSY = e.touches[0].clientY - panY; }
}, { passive: false });
canvas.addEventListener('touchmove', e => {
  e.preventDefault();
  if (e.touches.length === 2) {
    const d = Math.hypot(e.touches[0].clientX - e.touches[1].clientX, e.touches[0].clientY - e.touches[1].clientY);
    if (lDist) zoomAt(lMX, lMY, d / lDist); lDist = d;
  } else if (tPan) {
    panX = e.touches[0].clientX - dSX; panY = e.touches[0].clientY - dSY;
    clampPan(); drawMap();
  }
}, { passive: false });
canvas.addEventListener('touchend', () => { lDist = 0; tPan = false; });

document.getElementById('zoom-in-btn').addEventListener('click', () => zoomAt(getW() / 2, CANVAS_H / 2, ZSTEP));
document.getElementById('zoom-out-btn').addEventListener('click', () => zoomAt(getW() / 2, CANVAS_H / 2, 1 / ZSTEP));
document.getElementById('zoom-reset-btn').addEventListener('click', resetView);

// ── BFS state ─────────────────────────────────────────────────────────────────
let bfsSteps = [], currentStep = -1, animTimer = null;
let paused = false, running = false;
let nodeState = {}, highlightEdges = [];

// ── DOM refs ──────────────────────────────────────────────────────────────────
const startSel = document.getElementById('start-city');
const endSel = document.getElementById('end-city');
const runBtn = document.getElementById('run-btn');
const pauseBtn = document.getElementById('pause-btn');
const resetBtn = document.getElementById('reset-btn');
const speedSlider = document.getElementById('speed-slider');
const speedLabel = document.getElementById('speed-label');
const logBody = document.getElementById('log-body');
const clearLogBtn = document.getElementById('clear-log-btn');
const statusChip = document.getElementById('status-chip');
const stepCtr = document.getElementById('step-counter');
const visitedEl = document.getElementById('visited-chips');
const pathResult = document.getElementById('path-result');
const pathValue = document.getElementById('path-value');
const pathHops = document.getElementById('path-hops');
const alertBox = document.getElementById('alert-box');

// Populate dropdowns
stateNames.slice().sort().forEach(name => {
  [startSel, endSel].forEach(sel => {
    const o = document.createElement('option');
    o.value = name; o.textContent = name;
    sel.appendChild(o);
  });
});

function showAlert(msg) {
  alertBox.textContent = msg;
  alertBox.className = 'alert alert-error show';
  setTimeout(() => alertBox.className = 'alert alert-error', 2500);
}
function getDelay() { return parseInt(speedSlider.value); }
speedSlider.addEventListener('input', () => {
  speedLabel.textContent = (speedSlider.value / 1000).toFixed(1) + 's';
});

// ── Node colour ───────────────────────────────────────────────────────────────
function nodeColor(state) {
  switch (state) {
    case 'start': return { ring: '#6c63ff', fill: 'rgba(108,99,255,0.85)', text: '#fff', glow: 16 };
    case 'end': return { ring: '#ff6584', fill: 'rgba(255,101,132,0.85)', text: '#fff', glow: 16 };
    case 'current': return { ring: '#ffd166', fill: 'rgba(255,209,102,0.95)', text: '#111', glow: 24 };
    case 'visited': return { ring: '#00d4ff', fill: 'rgba(0,212,255,0.75)', text: '#fff', glow: 12 };
    case 'path': return { ring: '#00e5a0', fill: 'rgba(0,229,160,0.85)', text: '#fff', glow: 20 };
    default: return { ring: '#555e7a', fill: 'rgba(30,35,65,0.7)', text: '#c8d0e8', glow: 0 };
  }
}

// ── Draw ──────────────────────────────────────────────────────────────────────
function drawMap() {
  const W = getW();

  // Clear in screen space
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.restore();

  // All drawing inside zoom/pan transform
  ctx.save();
  ctx.translate(panX, panY);
  ctx.scale(zoom, zoom);

  const lw = 1 / zoom;

  // 1 — Background map image
  if (mapImage.complete && mapImage.naturalWidth > 0) {
    ctx.drawImage(mapImage, 0, 0, W, CANVAS_H);
  }

  // 2 — Adjacency edges
  STATE_EDGES.forEach(([a, b]) => {
    const p1 = statePos(a), p2 = statePos(b);
    const isPath = highlightEdges.some(([ra, rb]) => (ra === a && rb === b) || (ra === b && rb === a));

    if (isPath) {
      // Glowing path edge
      ctx.save();
      ctx.shadowColor = '#00e5a0'; ctx.shadowBlur = 18;
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = '#00e5a0'; ctx.lineWidth = 3.5 * lw;
      ctx.setLineDash([]); ctx.stroke();
      ctx.restore();
    } else {
      // Normal edge — dark line so it shows on the gray map
      ctx.beginPath(); ctx.moveTo(p1.x, p1.y); ctx.lineTo(p2.x, p2.y);
      ctx.strokeStyle = 'rgba(30,30,60,0.6)'; ctx.lineWidth = 2 * lw;
      ctx.setLineDash([4 * lw, 6 * lw]); ctx.stroke();
      ctx.setLineDash([]);
    }
  });

  // 3 — State nodes
  const r = NODE_R * lw;
  const fs = 8.5 * lw;

  stateNames.forEach(name => {
    const { x, y } = statePos(name);
    const s = nodeState[name] || 'default';
    const col = nodeColor(s);

    ctx.save();
    if (col.glow) { ctx.shadowColor = col.ring; ctx.shadowBlur = col.glow * lw; }

    // Outer glow ring for active states
    if (s !== 'default') {
      ctx.beginPath(); ctx.arc(x, y, r * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = col.ring + '28'; ctx.fill();
    }

    // White halo (always — makes node pop against map)
    ctx.beginPath(); ctx.arc(x, y, r + 2 * lw, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255,255,255,0.92)'; ctx.fill();

    // Coloured fill circle
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fillStyle = col.fill; ctx.fill();
    ctx.strokeStyle = col.ring;
    ctx.lineWidth = (s === 'current' ? 2.5 : 1.8) * lw;
    ctx.stroke();

    // Centre pin dot
    ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.arc(x, y, 2 * lw, 0, Math.PI * 2);
    ctx.fillStyle = col.ring; ctx.fill();
    ctx.restore();

    // State name label pill (shown only for active BFS states to avoid clutter)
    if (s !== 'default') {
      ctx.save();
      ctx.font = `700 ${fs}px 'Inter',sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'top';
      const labelY = y + r + 3 * lw;
      const tw = ctx.measureText(name).width;
      const pw = tw + 10 * lw, ph = fs + 6 * lw;
      ctx.fillStyle = 'rgba(0,0,0,0.85)';
      if (ctx.roundRect) { ctx.beginPath(); ctx.roundRect(x - pw / 2, labelY, pw, ph, 4 * lw); ctx.fill(); }
      else { ctx.fillRect(x - pw / 2, labelY, pw, ph); }
      ctx.fillStyle = col.text;
      ctx.fillText(name, x, labelY + 3 * lw);
      ctx.restore();
    }
  });

  ctx.restore(); // end zoom/pan

  // Zoom indicator
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.font = '600 10px "JetBrains Mono",monospace';
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.textAlign = 'right'; ctx.textBaseline = 'bottom';
  ctx.fillText(`×${zoom.toFixed(1)}`, (canvas.width / window.devicePixelRatio) - 10, CANVAS_H - 8);
  ctx.restore();
}

// ── BFS ───────────────────────────────────────────────────────────────────────
function bfsGenerateSteps(start, goal) {
  const steps = [], visited = new Set(), queue = [start], parent = { [start]: null };
  steps.push({ type: 'start', node: start, queue: [...queue], visited: [] });
  while (queue.length) {
    const state = queue.shift();
    if (visited.has(state)) { steps.push({ type: 'already_visited', node: state, queue: [...queue], visited: [...visited] }); continue; }
    visited.add(state);
    const isGoal = goal && state === goal;
    steps.push({ type: isGoal ? 'goal' : 'visit', node: state, queue: [...queue], visited: [...visited], parent: { ...parent } });
    if (isGoal) {
      const path = []; let curr = goal;
      while (curr !== null) { path.unshift(curr); curr = parent[curr]; }
      steps.push({ type: 'path', path, node: state, queue: [...queue], visited: [...visited] });
      return steps;
    }
    for (const nb of (graph[state] || []).slice().sort()) {
      if (!visited.has(nb) && !queue.includes(nb)) { queue.push(nb); parent[nb] = state; }
    }
    steps.push({ type: 'enqueue', node: state, queue: [...queue], visited: [...visited] });
  }
  steps.push({ type: 'done', queue: [], visited: [...visited] });
  return steps;
}

runBtn.addEventListener('click', startBFS);
function startBFS() {
  if (running) return;
  const start = startSel.value, goal = endSel.value;
  if (!start) { showAlert('Please select a start state.'); return; }
  if (!goal) { showAlert('Please select a destination state.'); return; }
  if (start === goal) { showAlert('Start and destination must be different.'); return; }

  clearLog(); pathResult.classList.remove('visible');
  visitedEl.innerHTML = ''; highlightEdges = [];
  nodeState = {}; stateNames.forEach(s => nodeState[s] = 'default');
  nodeState[start] = 'start'; nodeState[goal] = 'end';
  drawMap();
  bfsSteps = bfsGenerateSteps(start, goal);
  currentStep = 0; running = true; paused = false;
  runBtn.disabled = true; pauseBtn.disabled = false;
  setStatus('running');
  logLine(`BFS from <strong>${start}</strong> → <strong>${goal}</strong>`, 'log-info');
  scheduleStep();
}

function scheduleStep() { if (running) animTimer = setTimeout(playStep, getDelay()); }
function playStep() {
  if (paused || !running) return;
  if (currentStep >= bfsSteps.length) { finishBFS(); return; }
  const step = bfsSteps[currentStep];
  stepCtr.textContent = `${currentStep + 1} / ${bfsSteps.length}`;
  applyStep(step); currentStep++;
  if (step.type === 'done' || step.type === 'path') { finalizeRender(); return; }
  scheduleStep();
}

function applyStep(step) {
  const { type, node, queue } = step;
  switch (type) {
    case 'start':
      logLine(`<span class="log-info">↳ Queue: [<span class="log-queue">${node}</span>]</span>`); break;
    case 'visit': {
      stateNames.forEach(s => { if (nodeState[s] === 'current') nodeState[s] = 'visited'; });
      nodeState[node] = 'current';
      const chip = document.createElement('div');
      chip.className = 'vchip current'; chip.id = `vchip-${node}`; chip.textContent = node;
      visitedEl.appendChild(chip);
      setTimeout(() => { chip.classList.remove('current'); chip.classList.add('lit'); }, getDelay() * 0.6);
      logLine(`<span class="log-current">▶ <strong>${node}</strong></span> → [<span class="log-queue">${queue.join(' → ')}</span>]`);
      break;
    }
    case 'enqueue':
      logLine(`<span style="color:var(--text-muted)">  Queued → [<span class="log-queue">${queue.join(' → ')}</span>]</span>`); break;
    case 'goal': {
      stateNames.forEach(s => { if (nodeState[s] === 'current') nodeState[s] = 'visited'; });
      nodeState[node] = 'current';
      const chip = document.createElement('div');
      chip.className = 'vchip current'; chip.id = `vchip-${node}`; chip.textContent = node;
      visitedEl.appendChild(chip);
      logLine(`<span class="log-goal">🎯 <strong>${node}</strong> reached!</span>`); break;
    }
    case 'path': {
      step.path.forEach((s, i) => {
        nodeState[s] = i === 0 ? 'start' : i === step.path.length - 1 ? 'end' : 'path';
      });
      highlightEdges = [];
      for (let i = 0; i < step.path.length - 1; i++) highlightEdges.push([step.path[i], step.path[i + 1]]);
      step.path.forEach(s => {
        const ch = document.getElementById(`vchip-${s}`);
        if (ch) { ch.classList.remove('lit', 'current'); ch.classList.add('on-path'); }
      });
      drawMap();
      pathValue.textContent = step.path.join(' → ');
      pathHops.textContent = `${step.path.length - 1} hop${step.path.length - 1 !== 1 ? 's' : ''}`;
      pathResult.classList.add('visible');
      logLine(`<span class="log-path">✓ ${step.path.join(' → ')}</span>`);
      setStatus('done'); finishBFS(); return;
    }
    case 'done':
      logLine('<span class="log-info">✓ No path found.</span>'); setStatus('nopath'); break;
  }
  drawMap();
}

function finalizeRender() { running = false; pauseBtn.disabled = true; runBtn.disabled = false; }
function finishBFS() { running = false; paused = false; pauseBtn.disabled = true; runBtn.disabled = false; clearTimeout(animTimer); }

pauseBtn.addEventListener('click', () => {
  if (!running && !paused) return;
  paused = !paused; pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  if (!paused) scheduleStep();
});

resetBtn.addEventListener('click', () => {
  clearTimeout(animTimer); running = false; paused = false;
  currentStep = -1; bfsSteps = []; highlightEdges = [];
  runBtn.disabled = false; pauseBtn.disabled = true; pauseBtn.textContent = '⏸ Pause';
  setStatus('idle'); stepCtr.textContent = '—';
  pathResult.classList.remove('visible');
  visitedEl.innerHTML = '<span class="log-empty">—</span>';
  clearLog(); nodeState = {}; stateNames.forEach(s => nodeState[s] = 'default');
  initCanvas(); drawMap();
  logLine('Select states and press <strong>Find Shortest Path</strong>.', 'log-info');
});

// Log
let logCount = 0;
function logLine(html, cls = '') {
  logCount++;
  const d = document.createElement('div');
  d.className = 'log-line ' + (cls || '');
  d.innerHTML = `<span class="step-num">${String(logCount).padStart(2, '0')}</span><span>${html}</span>`;
  logBody.appendChild(d); logBody.scrollTop = logBody.scrollHeight;
}
function clearLog() { logBody.innerHTML = ''; logCount = 0; }
clearLogBtn.addEventListener('click', clearLog);

function setStatus(s) {
  const m = { idle: ['chip-idle', '<div class="dot"></div> Idle'], running: ['chip-running', '<div class="dot pulse"></div> Searching…'], done: ['chip-done', '<div class="dot"></div> Route Found'], nopath: ['chip-nopath', '<div class="dot"></div> No Route'] };
  statusChip.className = 'status-chip ' + m[s][0]; statusChip.innerHTML = m[s][1];
}

// ── Init ──────────────────────────────────────────────────────────────────────
function init() {
  nodeState = {}; stateNames.forEach(s => nodeState[s] = 'default');
  canvas.style.cursor = 'grab'; initCanvas(); drawMap();
}
window.addEventListener('resize', () => { initCanvas(); drawMap(); });
init();
logLine('Select states and press <strong>Find Shortest Path</strong> to start.', 'log-info');
