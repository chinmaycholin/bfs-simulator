// ── State ──────────────────────────────────────────────────────────────────
let edges = [];        // [{a, b}]
let graph = {};        // adjacency list
let numNodes = 5;
let nodePositions = []; // [{x, y}]
let bfsSteps = [];
let currentStep = -1;
let animTimer = null;
let paused = false;
let running = false;

// 'default' | 'current' | 'visited' | 'path' | 'start' | 'end'
let nodeState = [];

// ── DOM refs ────────────────────────────────────────────────────────────────
const canvas       = document.getElementById('bfs-canvas');
const ctx          = canvas.getContext('2d');
const numNodesInput = document.getElementById('num-nodes');
const edgeFromIn   = document.getElementById('edge-from');
const edgeToIn     = document.getElementById('edge-to');
const addEdgeBtn   = document.getElementById('add-edge-btn');
const edgeListEl   = document.getElementById('edge-list');
const startNodeIn  = document.getElementById('start-node');
const endNodeIn    = document.getElementById('end-node');
const runBtn       = document.getElementById('run-btn');
const pauseBtn     = document.getElementById('pause-btn');
const resetBtn     = document.getElementById('reset-btn');
const speedSlider  = document.getElementById('speed-slider');
const speedLabel   = document.getElementById('speed-label');
const logBody      = document.getElementById('log-body');
const clearLogBtn  = document.getElementById('clear-log-btn');
const statusChip   = document.getElementById('status-chip');
const stepCounter  = document.getElementById('step-counter');
const visitedChipsEl = document.getElementById('visited-chips');
const pathResult   = document.getElementById('path-result');
const pathValue    = document.getElementById('path-value');
const alertBox     = document.getElementById('alert-box');
const presetBtn    = document.getElementById('preset-btn');

// ── Helpers ──────────────────────────────────────────────────────────────────
function showAlert(msg, type = 'error') {
  alertBox.textContent = msg;
  alertBox.className = `alert alert-${type} show`;
  setTimeout(() => alertBox.className = 'alert alert-' + type, 2500);
}

function getDelay() { return parseInt(speedSlider.value); }

speedSlider.addEventListener('input', () => {
  speedLabel.textContent = (speedSlider.value / 1000).toFixed(1) + 's';
});

// ── Node layout ──────────────────────────────────────────────────────────────
function layoutNodes(n) {
  const W = canvas.offsetWidth || 700;
  const H = 400;
  canvas.width  = W * window.devicePixelRatio;
  canvas.height = H * window.devicePixelRatio;
  ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
  canvas.style.height = H + 'px';

  const PAD      = NODE_R + 16;       // margin from canvas edges
  const MIN_DIST = NODE_R * 2.8;      // minimum gap between node centres
  nodePositions  = [];

  for (let i = 0; i < n; i++) {
    let pos, attempts = 0;
    do {
      pos = {
        x: PAD + Math.random() * (W - PAD * 2),
        y: PAD + Math.random() * (H - PAD * 2)
      };
      attempts++;
    } while (
      attempts < 300 &&
      nodePositions.some(p => Math.hypot(p.x - pos.x, p.y - pos.y) < MIN_DIST)
    );
    nodePositions.push(pos);
  }
}

// ── Build adjacency list ──────────────────────────────────────────────────────
function buildGraph() {
  numNodes = parseInt(numNodesInput.value) || 5;
  graph = {};
  for (let i = 0; i < numNodes; i++) graph[String(i)] = [];
  for (const e of edges) {
    if (!graph[e.a]) graph[e.a] = [];
    if (!graph[e.b]) graph[e.b] = [];
    if (!graph[e.a].includes(e.b)) graph[e.a].push(e.b);
    if (!graph[e.b].includes(e.a)) graph[e.b].push(e.a);
  }
}

// ── Drawing ───────────────────────────────────────────────────────────────────
const NODE_R = 22;

function colorForState(state) {
  switch (state) {
    case 'current': return { fill: '#ffd166',   stroke: '#ffd166', text: '#0d0f1a' };
    case 'visited': return { fill: '#00d4ff22', stroke: '#00d4ff', text: '#00d4ff' };
    case 'path':    return { fill: '#00e5a022', stroke: '#00e5a0', text: '#00e5a0' };
    case 'start':   return { fill: '#6c63ff33', stroke: '#6c63ff', text: '#a5a0ff' };
    case 'end':     return { fill: '#ff658433', stroke: '#ff6584', text: '#ff9eb2' };
    default:        return { fill: '#1c1f35',   stroke: '#2a2e4a', text: '#7b82a8' };
  }
}

function drawGraph(highlightEdges = []) {
  const W = canvas.width  / window.devicePixelRatio;
  const H = canvas.height / window.devicePixelRatio;
  ctx.clearRect(0, 0, W, H);

  // Subtle dot grid
  ctx.fillStyle = 'rgba(42,46,74,0.3)';
  for (let x = 30; x < W; x += 30)
    for (let y = 30; y < H; y += 30) {
      ctx.beginPath();
      ctx.arc(x, y, 1, 0, Math.PI * 2);
      ctx.fill();
    }

  // Edges
  for (const e of edges) {
    const a = parseInt(e.a), b = parseInt(e.b);
    if (isNaN(a) || isNaN(b) || !nodePositions[a] || !nodePositions[b]) continue;
    const p1 = nodePositions[a], p2 = nodePositions[b];
    const isHL = highlightEdges.some(h => (h[0]===a && h[1]===b) || (h[0]===b && h[1]===a));
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    if (isHL) {
      ctx.strokeStyle = '#00e5a0';
      ctx.lineWidth   = 3;
      ctx.shadowColor = '#00e5a0';
      ctx.shadowBlur  = 10;
    } else {
      ctx.strokeStyle = '#2a2e4a';
      ctx.lineWidth   = 1.5;
      ctx.shadowBlur  = 0;
    }
    ctx.setLineDash([]);
    ctx.stroke();
    ctx.shadowBlur = 0;
  }

  // Nodes
  for (let i = 0; i < numNodes; i++) {
    if (!nodePositions[i]) continue;
    const { x, y } = nodePositions[i];
    const state = nodeState[i] || 'default';
    const col   = colorForState(state);

    ctx.shadowColor = col.stroke;
    ctx.shadowBlur  = state === 'current' ? 24 : state === 'path' ? 12 : state === 'visited' ? 6 : 0;

    // Fill circle
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.fillStyle = col.fill;
    ctx.fill();

    // Border
    ctx.beginPath();
    ctx.arc(x, y, NODE_R, 0, Math.PI * 2);
    ctx.strokeStyle = col.stroke;
    ctx.lineWidth   = state === 'current' ? 2.5 : 1.8;
    ctx.stroke();
    ctx.shadowBlur  = 0;

    // Label
    ctx.fillStyle    = col.text;
    ctx.font         = `600 ${NODE_R * 0.72}px 'JetBrains Mono', monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(i), x, y);
  }
  ctx.setLineDash([]);
}

// ── Edge management ───────────────────────────────────────────────────────────
function renderEdgeList() {
  if (edges.length === 0) {
    edgeListEl.innerHTML = '<span class="log-empty">No edges yet…</span>';
    return;
  }
  edgeListEl.innerHTML = '';
  edges.forEach((e, i) => {
    const tag = document.createElement('div');
    tag.className = 'edge-tag';
    tag.innerHTML = `${e.a} ↔ ${e.b} <span class="remove" data-i="${i}" title="Remove">✕</span>`;
    edgeListEl.appendChild(tag);
  });
  edgeListEl.querySelectorAll('.remove').forEach(btn => {
    btn.addEventListener('click', () => {
      edges.splice(parseInt(btn.dataset.i), 1);
      renderEdgeList();
      refreshCanvas();
    });
  });
}

addEdgeBtn.addEventListener('click', addEdge);
[edgeFromIn, edgeToIn].forEach(inp => inp.addEventListener('keydown', e => { if (e.key === 'Enter') addEdge(); }));

function addEdge() {
  const a = edgeFromIn.value.trim();
  const b = edgeToIn.value.trim();
  const n = parseInt(numNodesInput.value) || 5;

  if (a === '' || b === '') { showAlert('Please enter both endpoints.'); return; }
  if (isNaN(parseInt(a)) || isNaN(parseInt(b))) { showAlert('Node labels must be numbers.'); return; }
  if (parseInt(a) >= n || parseInt(b) >= n || parseInt(a) < 0 || parseInt(b) < 0) {
    showAlert(`Nodes must be between 0 and ${n - 1}.`); return;
  }
  if (a === b) { showAlert('Self-loops not allowed.'); return; }
  if (edges.some(e => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
    showAlert('Edge already exists.'); return;
  }
  edges.push({ a, b });
  edgeFromIn.value = '';
  edgeToIn.value   = '';
  edgeFromIn.focus();
  renderEdgeList();
  refreshCanvas();
}

numNodesInput.addEventListener('change', () => {
  numNodes = parseInt(numNodesInput.value) || 5;
  edges    = edges.filter(e => parseInt(e.a) < numNodes && parseInt(e.b) < numNodes);
  renderEdgeList();
  refreshCanvas();
});

function refreshCanvas() {
  buildGraph();
  layoutNodes(numNodes);
  nodeState = Array(numNodes).fill('default');
  drawGraph();
}

// ── BFS algorithm (generates step list) ──────────────────────────────────────
function bfsGenerateSteps(graphObj, start, goal) {
  const steps  = [];
  const visited = new Set();
  const queue  = [start];
  const parent = { [start]: null };

  steps.push({ type: 'start', node: start, queue: [...queue], visited: [] });

  while (queue.length > 0) {
    const vertex = queue.shift();

    if (visited.has(vertex)) {
      steps.push({ type: 'already_visited', node: vertex, queue: [...queue], visited: [...visited] });
      continue;
    }
    visited.add(vertex);

    steps.push({
      type: goal && vertex === goal ? 'goal' : 'visit',
      node: vertex,
      queue: [...queue],
      visited: [...visited],
      parent: { ...parent }
    });

    if (goal && vertex === goal) {
      const path = [];
      let curr = goal;
      while (curr !== null) { path.unshift(curr); curr = parent[curr]; }
      steps.push({ type: 'path', path, node: vertex, queue: [...queue], visited: [...visited] });
      return steps;
    }

    const neighbors = (graphObj[vertex] || []).slice().sort();
    for (const nb of neighbors) {
      if (!visited.has(nb) && !queue.includes(nb)) {
        queue.push(nb);
        parent[nb] = vertex;
      }
    }
    steps.push({ type: 'enqueue', node: vertex, queue: [...queue], visited: [...visited] });
  }

  steps.push({ type: 'done', queue: [], visited: [...visited] });
  return steps;
}

// ── Run BFS ───────────────────────────────────────────────────────────────────
runBtn.addEventListener('click', startBFS);

function startBFS() {
  if (running) return;
  buildGraph();
  const n        = parseInt(numNodesInput.value) || 5;
  const startRaw = startNodeIn.value.trim();
  const endRaw   = endNodeIn.value.trim();

  if (startRaw === '') { showAlert('Please enter a start node.'); return; }
  if (isNaN(parseInt(startRaw)) || parseInt(startRaw) < 0 || parseInt(startRaw) >= n) {
    showAlert(`Start node must be between 0 and ${n - 1}.`); return;
  }
  if (endRaw && (isNaN(parseInt(endRaw)) || parseInt(endRaw) < 0 || parseInt(endRaw) >= n)) {
    showAlert(`Goal node must be between 0 and ${n - 1}.`); return;
  }

  const start = startRaw;
  const goal  = endRaw || null;

  clearLog();
  pathResult.classList.remove('visible');
  visitedChipsEl.innerHTML = '';
  nodeState = Array(numNodes).fill('default');
  nodeState[parseInt(start)] = 'start';
  if (goal) nodeState[parseInt(goal)] = 'end';
  layoutNodes(numNodes);
  drawGraph();

  bfsSteps    = bfsGenerateSteps(graph, start, goal);
  currentStep = 0;
  running     = true;
  paused      = false;
  runBtn.disabled   = true;
  pauseBtn.disabled = false;
  setStatus('running');
  logLine(`BFS starting from node <strong>${start}</strong>${goal ? ` → Goal: <strong>${goal}</strong>` : ' (full traversal)'}`, 'log-info');

  const nodeIds = Object.keys(graph).sort((a, b) => parseInt(a) - parseInt(b));
  visitedChipsEl.innerHTML = nodeIds.map(id => `<div class="vchip" id="vchip-${id}">${id}</div>`).join('');
  if (goal) document.getElementById(`vchip-${goal}`)?.style.setProperty('border-color', 'var(--accent3)');
  document.getElementById(`vchip-${start}`)?.style.setProperty('border-color', 'var(--accent)');

  scheduleStep();
}

function scheduleStep() {
  if (!running) return;
  animTimer = setTimeout(playStep, getDelay());
}

function playStep() {
  if (paused || !running) return;
  if (currentStep >= bfsSteps.length) { finishBFS(); return; }

  const step = bfsSteps[currentStep];
  stepCounter.textContent = `${currentStep + 1} / ${bfsSteps.length}`;
  applyStep(step);
  currentStep++;

  if (step.type === 'done' || step.type === 'path') { finalizeRender(); return; }
  scheduleStep();
}

function applyStep(step) {
  const { type, node, queue, visited } = step;
  let pathEdges = [];

  switch (type) {
    case 'start':
      nodeState[parseInt(node)] = 'start';
      logLine(`<span class="log-info">↳ Queue initialized: [<span class="log-queue">${node}</span>]</span>`);
      break;

    case 'visit':
      nodeState = nodeState.map(s => s === 'current' ? 'visited' : s);
      nodeState[parseInt(node)] = 'current';
      if (parseInt(node) !== parseInt(startNodeIn.value)) {
        document.getElementById(`vchip-${node}`)?.classList.add('current');
        setTimeout(() => {
          document.getElementById(`vchip-${node}`)?.classList.remove('current');
          document.getElementById(`vchip-${node}`)?.classList.add('lit');
        }, getDelay() * 0.6);
      }
      logLine(`<span class="log-current">▶ Visiting node ${node}</span>  Queue: [<span class="log-queue">${queue.join(', ')}</span>]`);
      break;

    case 'enqueue':
      logLine(`<span style="color:var(--text-muted)">  Neighbors enqueued. Queue → [<span class="log-queue">${queue.join(', ')}</span>]</span>`);
      break;

    case 'goal':
      nodeState = nodeState.map(s => s === 'current' ? 'visited' : s);
      nodeState[parseInt(node)] = 'current';
      logLine(`<span class="log-goal">🎯 Goal node ${node} reached!</span>`);
      break;

    case 'path':
      step.path.forEach(n => {
        if (n !== startNodeIn.value.trim() && n !== endNodeIn.value.trim())
          nodeState[parseInt(n)] = 'path';
      });
      nodeState[parseInt(startNodeIn.value.trim())] = 'start';
      nodeState[parseInt(endNodeIn.value.trim())]   = 'end';
      for (let i = 0; i < step.path.length - 1; i++)
        pathEdges.push([parseInt(step.path[i]), parseInt(step.path[i + 1])]);
      step.path.forEach(n => {
        const c = document.getElementById(`vchip-${n}`);
        if (c) { c.classList.remove('lit', 'current'); c.classList.add('on-path'); }
      });
      drawGraph(pathEdges);
      const pathStr = step.path.join(' → ');
      pathValue.textContent = pathStr;
      pathResult.classList.add('visible');
      logLine(`<span class="log-path">✓ Shortest path: ${pathStr}</span>`);
      setStatus('done');
      finishBFS();
      return;

    case 'done':
      logLine(`<span class="log-info">✓ Full traversal complete. ${visited.length} nodes visited.</span>`);
      setStatus('done');
      break;

    case 'already_visited':
      break;
  }
  drawGraph(pathEdges);
}

function finalizeRender() {
  running = false;
  pauseBtn.disabled = true;
  runBtn.disabled   = false;
}

function finishBFS() {
  running = false;
  paused  = false;
  pauseBtn.disabled = true;
  runBtn.disabled   = false;
  clearTimeout(animTimer);
}

// ── Pause / Reset ─────────────────────────────────────────────────────────────
pauseBtn.addEventListener('click', () => {
  if (!running && !paused) return;
  paused = !paused;
  pauseBtn.textContent = paused ? '▶ Resume' : '⏸ Pause';
  if (!paused) scheduleStep();
});

resetBtn.addEventListener('click', () => {
  clearTimeout(animTimer);
  running = false; paused = false;
  currentStep = -1; bfsSteps = [];
  runBtn.disabled   = false;
  pauseBtn.disabled = true;
  pauseBtn.textContent = '⏸ Pause';
  setStatus('idle');
  stepCounter.textContent = '—';
  pathResult.classList.remove('visible');
  visitedChipsEl.innerHTML = '<span class="log-empty">—</span>';
  clearLog();
  refreshCanvas();
  logLine('Graph reset. Configure and press <strong>Run BFS</strong>.', 'log-info');
});

// ── Log ───────────────────────────────────────────────────────────────────────
let logCount = 0;

function logLine(html, cls = '') {
  logCount++;
  const div = document.createElement('div');
  div.className = 'log-line ' + (cls || '');
  div.innerHTML = `<span class="step-num">${String(logCount).padStart(2, '0')}</span><span>${html}</span>`;
  logBody.appendChild(div);
  logBody.scrollTop = logBody.scrollHeight;
}

function clearLog() { logBody.innerHTML = ''; logCount = 0; }
clearLogBtn.addEventListener('click', clearLog);

// ── Status chip ───────────────────────────────────────────────────────────────
function setStatus(s) {
  const map = {
    idle:    ['chip-idle',    '<div class="dot"></div> Idle'],
    running: ['chip-running', '<div class="dot pulse"></div> Running…'],
    done:    ['chip-done',    '<div class="dot"></div> Done'],
    nopath:  ['chip-nopath',  '<div class="dot"></div> No Path']
  };
  statusChip.className = 'status-chip ' + map[s][0];
  statusChip.innerHTML = map[s][1];
}

// ── Preset graph ──────────────────────────────────────────────────────────────
presetBtn.addEventListener('click', () => {
  const n = Math.max(2, parseInt(numNodesInput.value) || 5);
  numNodes = n;
  numNodesInput.value = n;

  const edgeSet = new Set();
  const addE = (a, b) => {
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edgeSet.has(key)) { edgeSet.add(key); edges.push({ a: String(a), b: String(b) }); }
  };
  edges = [];

  // Random spanning tree (guarantees connectivity)
  const shuffled = Array.from({ length: n }, (_, i) => i).sort(() => Math.random() - 0.5);
  for (let i = 1; i < n; i++) {
    const parent = shuffled[Math.floor(Math.random() * i)];
    addE(shuffled[i], parent);
  }

  // Extra edges for variety
  const extras = Math.max(1, Math.floor(n / 2));
  for (let k = 0; k < extras * 10 && edgeSet.size < (n - 1 + extras); k++) {
    const a = Math.floor(Math.random() * n);
    const b = Math.floor(Math.random() * n);
    if (a !== b) addE(a, b);
  }

  startNodeIn.value = '0';
  endNodeIn.value   = String(n - 1);
  renderEdgeList();
  refreshCanvas();
  logLine(`Example graph loaded (${n} nodes, ${edges.length} edges). Start: 0, Goal: ${n - 1}.`, 'log-info');
});

// ── Init ──────────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => { if (!running) refreshCanvas(); });
refreshCanvas();
logLine('Configure your graph and press <strong>Run BFS</strong> to start.', 'log-info');
