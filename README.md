# AOS Intelligence Dashboard

> Hardware-Souveränität und GZMO-Telemetrie für AgenticOS — Echtzeit-Energiemonitor und LLM-Leaderboard direkt in VS Codium.

## Features

- **Status Bar** — Zeigt das aktive Modell und Verbindungsstatus permanent an
- **Intelligence Dashboard** (Sidebar) — Live-Metriken: Energie, z-Score, $OBL-Preis via WebSocket
- **Benchmark Wizard** — Interaktives Formular zur GZMO-Kalibrierung mit Hardware Routing Override
- **Model Leaderboard** — Sortierbare Tabelle aller bewerteten Modelle nach Intelligence-per-Watt

## Voraussetzungen

- [VS Codium](https://vscodium.com/) oder VS Code ≥ 1.85
- Node.js ≥ 18
- AOS FastAPI Gateway läuft auf `localhost:8000`

## Development

```bash
# Abhängigkeiten installieren
npm install

# Extension + Webviews kompilieren
npm run build

# Watch Mode (alle Targets parallel)
npm run watch

# VSIX-Paket erstellen
npm run package
```

Zum Testen: **F5** drücken, um den Extension Development Host zu starten.

## Architektur

```
src/              Extension Host (Node.js)
  ├── config/     Zentrale Konfiguration (URLs, Timeouts)
  ├── types/      Gemeinsame TypeScript Interfaces
  ├── services/   Backend-Kommunikation (WebSocket)
  ├── panels/     Webview Panel Controller (Tabs)
  ├── providers/  WebviewViewProvider (Sidebar)
  └── utils/      Geteilte Hilfsfunktionen

webview/          Webview Client (Browser Sandbox)
  ├── sidebar/    Dashboard Frontend
  ├── wizard/     Benchmark Wizard Frontend
  └── leaderboard/  Leaderboard Frontend
```

## Tech Stack

| Komponente | Technologie |
|---|---|
| Sprache | TypeScript (strict) |
| Bundler | esbuild |
| WebSocket | ws |
| HTTP | Native fetch (Node 18+) |
| UI | Vanilla HTML/CSS (VS Code CSS Variables) |

## Lizenz

MIT © Maximilian Wruhs
