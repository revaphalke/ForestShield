# ForestShield

ForestShield is a **simulation-only** forest evacuation demonstrator. It keeps a five-step UX:

1. Choose a forest
2. Choose your current zone
3. Choose your current grid cell
4. Report fire + scenario inputs
5. Review the safest route

> **Simulation only — call local emergency services for real emergencies.**

## Requirements

- Node.js 22+ (Node 24 is supported)
- A C compiler and `make` for the native engine (GCC/Make on Linux/macOS; MinGW/MSYS2 or WSL on Windows)

## Install and run the React app

### Windows PowerShell

```powershell
npm install
npm run dev
```

Open `http://localhost:8081/`.

### macOS / Linux

```bash
npm install
npm run dev
```

Open `http://localhost:8081/`.

The TypeScript pathfinder is the deterministic fallback. If the C engine is not running, the UI explicitly reports **TypeScript fallback**.

## Build and run the C engine

The native HTTP engine listens on port `8090`.

### macOS / Linux

```bash
npm run generate:c-config
make -C c
make -C c test
./c/forestshield
```

### Windows with MSYS2/MinGW or WSL

Run the same commands from the MSYS2/WSL terminal:

```bash
npm run generate:c-config
make -C c
make -C c test
./c/forestshield
```

The React dev server proxies `/c-api/*` to `http://127.0.0.1:8090`. For a deployed app, set `VITE_C_ENGINE_URL` to the public C-engine base URL or configure the same `/c-api` reverse proxy.

The C server serves its standalone files from `c/web` only. It also serves the shared graph JSON and map assets needed by that demo.

## Tests and quality gates

```bash
npm run typecheck
npm run lint
npm test
make -C c test
npm run build
```

`npm test` regenerates `c/graph_config.h` from `config/forest-graph.json` and runs the C/TypeScript parity fixtures when a C compiler is available.

## Shared graph configuration

Edit **only** `config/forest-graph.json` for trail topology, exits, exit weights, grid size and graph constants. Then run:

```bash
npm run generate:c-config
```

This generates `c/graph_config.h`; do not edit the generated header by hand.

## Scenario risk model

The risk model is transparent and deterministic. Inputs are:

- wind direction
- wind speed
- slope
- a 0/10/20/30 minute spread horizon

Fire spread uses BFS layers with a deterministic wind/slope bias. Rule-based simulation only; no trained models are used.
