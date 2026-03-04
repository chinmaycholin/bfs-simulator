# State Route Finder — BFS on Indian States

An interactive, browser-based **Breadth-First Search (BFS)** pathfinder built on a real map of India. Select a starting state and a destination, then watch BFS discover the shortest route across India's state border network — step by step.

🔗 **[Live Demo](https://chinmaycholin.github.io/BFS-State-Route/)**

---

## Features

- 🗺️ **Real India map background** — state nodes are placed at their actual geographic positions on `india_bg.png`
- 🔍 **Shortest path finding** — BFS finds the fewest-hop route between any two Indian states via shared borders
- 🎬 **Step-by-step animation** — watch BFS visit states one at a time with configurable speed
- � **Zoom & pan** — scroll to zoom, drag to pan; pinch-to-zoom supported on touch devices
- 📋 **Live BFS log** — shows each state visited and the current queue at every step
- ⏸ **Playback controls** — pause, resume, and reset at any time
- 🟢 **Shortest path highlight** — the final route is drawn as a glowing green trail on the map

## Node Color Guide

| Color | Meaning |
|-------|---------|
| 🟣 Purple / Dark | Unvisited state |
| � Purple (filled) | Start state |
| 🔴 Pink | Destination state |
| �🟡 Yellow | Currently being processed |
| 🔵 Cyan | Already visited |
| 🟢 Green | On the shortest path |

## How to Use

1. Select a **Start State** from the dropdown
2. Select a **Destination State** from the dropdown
3. Click **▶ Find Shortest Path** to begin the BFS animation
4. Use **⏸ Pause** / **▶ Resume** and **↺ Reset** to control playback
5. Drag the **Speed** slider to adjust animation delay (0.15s – 2s)
6. Use **Scroll** or the **+/−** buttons to zoom; **Drag** to pan the map

## Project Structure

```
bfs-simulator/
├── index.html        # HTML structure & UI controls
├── style.css         # Styles & animations (dark theme, glassmorphism)
├── app.js            # BFS logic, canvas rendering, zoom/pan, event handlers
├── india_states.js   # State node positions (as image fractions) & border adjacency edges
└── india_bg.png      # India map background image
```

## Graph Data (`india_states.js`)

- **30 Indian states** are defined with normalized `(fx, fy)` coordinates matching their position on the map image.
- **Border adjacency edges** represent states that share a physical border (e.g. `Maharashtra ↔ Goa`).
- The adjacency list is built at runtime in `app.js` from these edges.

## BFS Algorithm

The simulator implements standard BFS using a queue to find the shortest (fewest-hop) path:

```
1. Enqueue start state
2. While queue is not empty:
   a. Dequeue front state
   b. If already visited, skip
   c. Mark as visited
   d. If goal state reached, reconstruct & display path
   e. Enqueue all unvisited border-neighbours
```

Path reconstruction backtracks from `goal → start` using a `parent` map.

## Running Locally

No build tools needed — just open `index.html` in any modern browser.

```bash
git clone https://github.com/chinmaycholin/BFS-State-Route.git
cd BFS-State-Route
# open index.html in your browser
```
