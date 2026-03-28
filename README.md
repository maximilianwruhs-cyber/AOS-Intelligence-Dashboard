# AOS Intelligence Dashboard

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)
[![VS Code: ^1.85](https://img.shields.io/badge/VS%20Code-%5E1.85-blue?logo=visual-studio-code)](https://vscodium.com/)
[![Part of: AgenticOS](https://img.shields.io/badge/ecosystem-AgenticOS-blue)](https://github.com/maximilianwruhs-cyber)

> Hardware sovereignty and GZMO telemetry for AgenticOS — real-time energy monitoring and LLM leaderboard directly inside VS Codium.

## Features

- **Status Bar** — Displays the active model and connection status permanently
- **Intelligence Dashboard** (Sidebar) — Live metrics: energy, z-score, $OBL price via WebSocket
- **Benchmark Wizard** — Interactive form for GZMO calibration with hardware routing override
- **Model Leaderboard** — Sortable table of all evaluated models ranked by Intelligence per Watt

## Prerequisites

- [VS Codium](https://vscodium.com/) or VS Code ≥ 1.85
- Node.js ≥ 18
- AOS FastAPI Gateway running on `localhost:8000`

## Development

```bash
# Install dependencies
npm install

# Compile extension + webviews
npm run build

# Watch mode (all targets in parallel)
npm run watch

# Create VSIX package
npm run package
```

Press **F5** to launch the Extension Development Host for testing.

## Architecture

```
src/              Extension Host (Node.js)
  ├── config/     Central configuration (URLs, timeouts)
  ├── types/      Shared TypeScript interfaces
  ├── services/   Backend communication (WebSocket)
  ├── panels/     Webview Panel controllers (tabs)
  ├── providers/  WebviewViewProvider (sidebar)
  └── utils/      Shared utility functions

webview/          Webview Client (Browser Sandbox)
  ├── sidebar/    Dashboard frontend
  ├── wizard/     Benchmark Wizard frontend
  └── leaderboard/  Leaderboard frontend
```

## Tech Stack

| Component | Technology |
|---|---|
| Language | TypeScript (strict) |
| Bundler | esbuild |
| WebSocket | ws |
| HTTP | Native fetch (Node 18+) |
| UI | Vanilla HTML/CSS (VS Code CSS variables) |

---

## AgenticOS Ecosystem

| Project | Description |
|---------|-------------|
| [**AOS**](https://github.com/maximilianwruhs-cyber/AOS) | The flagship sovereign AI layer — core architecture & development |
| [**AOS Customer Edition**](https://github.com/maximilianwruhs-cyber/AOS-Customer-Edition) | Zero-touch deployment — one `curl` command installs everything |
| [**Obolus**](https://github.com/maximilianwruhs-cyber/Obolus) | Intelligence per Watt — benchmark which LLM is most efficient on your hardware |
| [**HSP**](https://github.com/maximilianwruhs-cyber/HSP) | Hardware Sonification Pipeline — turn machine telemetry into music |
| [**HSP VS Codium Extension**](https://github.com/maximilianwruhs-cyber/HSP-VS-Codium-Extension) | VS Codium sidebar for live HSP telemetry visualization |

## License

MIT © Maximilian Wruhs
