# Omni Pot（万点）

Cross-platform desktop translation, OCR and dictionary tool. Built with Electron + React + TypeScript.

[中文](README_CN.md)

## Features

- **Translate** — multi-engine parallel translation with system-wide text selection and clipboard monitoring
- **Dictionary** — word lookup with English and Chinese dictionary support
- **OCR** — screenshot region → text recognition
- **Screenshot Translate** — screenshot → recognize → auto translate
- **TTS** — text-to-speech for translation results
- **HTTP API** — local HTTP server for external scripts
- **System Tray** — always running, global hotkeys

## About

Omni Pot is a complete rewrite of [pot-app/pot-desktop](https://github.com/pot-app/pot-desktop), rebuilt from the ground up with Electron + React + TypeScript. It implements all features of the original while modernizing the tech stack.

## Tech Stack

Electron 39 · React 19 · TypeScript 6 · electron-vite · Tailwind CSS · Zustand · better-sqlite3

## Quick Start

```bash
git clone https://github.com/TuTouPower/omni_pot.git
cd omni_pot
npm install
npm run build:chinese-dictionary   # generate dictionary DB
npm run dev                        # start dev mode
```

## Commands

| Command | Description |
|---|---|
| `npm run dev` | Start dev mode with HMR |
| `npm run build` | Build (no packaging) |
| `npm run dist` | Build + package installer + portable |
| `npm test` | Run unit tests |
| `npm run test:e2e` | Run end-to-end tests |
| `npm run typecheck` | TypeScript type check |
| `npm run lint` | ESLint check |

## Project Structure

| Directory | Description |
|---|---|
| `src/main/` | Main process (window management, IPC, services, config) |
| `src/` | Renderer process (React UI) |
| `src/shared/` | Shared types between main/renderer |
| `public/` | Static assets (logos) |
| `data/` | Dictionary data, Tesseract training data |
| `scripts/` | Build/release automation scripts |
| `tests/` | Unit tests |
| `tests/e2e/` | End-to-end tests |
| `docs/` | Project documentation (spec, design, tests) |

## Documentation

See `docs/SPEC.md` for the full product specification. Additional docs in `docs/` cover testing, API, release procedures, and external service integration.

## Pricing

Omni Pot is **free to use**. All features are available at no cost.

The pricing displayed on our website ([zzzkkkccc.site](https://www.zzzkkkccc.site/)) exists solely to satisfy payment platform requirements for listing on international app stores — it does not reflect any actual charges.

## License

[AGPL-3.0](LICENSE)
