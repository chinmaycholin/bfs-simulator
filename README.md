# BFS Simulator

An interactive, browser-based **Breadth-First Search (BFS)** visualizer. Build a custom graph, set a start and optional goal node, and watch the algorithm traverse step by step — with live queue updates, path highlighting, and a detailed log.

🔗 **[Live Demo](https://chinmaycholin.github.io/BFS-State-Route/)**

---

## Features

- 🎨 **Interactive graph builder** — set node count, add/remove edges manually, or load a random example graph
- 🎬 **Step-by-step animation** — watch BFS visit nodes one at a time with configurable speed
- 🔍 **Shortest path highlighting** — finds and highlights the path between start and goal nodes
- 📋 **Live BFS log** — shows each node visited and the current queue state
- ⏸ **Playback controls** — pause, resume, and reset at any time
- 🎲 **Random layout** — nodes are placed randomly on the canvas (no boring circles)

## Node Color Guide

| Color | Meaning |
|-------|---------|
| 🟣 Purple | Unvisited |
| 🟡 Yellow | Currently being processed |
| 🔵 Cyan | Already visited |
| 🟢 Green | On the shortest path |
| 🔴 Pink | Goal node |

## How to Use

1. Enter the **number of nodes** (2–20)
2. Add **edges** manually (From ↔ To) — or click **✦ Load Example Graph** to auto-generate one
3. Set a **Start Node** and optionally a **Goal Node** (leave blank for full traversal)
4. Click **▶ Run BFS** and watch it go
5. Use **⏸ Pause**, **▶ Resume**, and **↺ Reset** to control playback
6. Drag the **Speed** slider to adjust animation delay (0.1s – 2s)

## Project Structure

```
bfs-simulator/
├── index.html   # HTML structure
├── style.css    # Styles & animations
└── app.js       # BFS logic, canvas rendering, event handlers
```

## BFS Algorithm

The simulator implements standard BFS using a queue:

```
1. Enqueue start node
2. While queue is not empty:
   a. Dequeue front node
   b. If already visited, skip
   c. Mark as visited
   d. If goal node reached, reconstruct & return path
   e. Enqueue all unvisited neighbours
```

Path reconstruction backtracks from goal → start using a `parent` map.

## Running Locally

No build tools needed — just open `index.html` in any modern browser.

```bash
git clone https://github.com/chinmaycholin/bfs-simulator.git
cd bfs-simulator
# open index.html in your browser
```
