# AGENTS.md

## Cursor Cloud specific instructions

This is a single, dependency-light static front-end product (no backend, no database). It is a React 19 + Vite 7 WebGL gallery ("Voroforce") that renders film/anime posters in an interactive Voronoi diagram. All data/media are local static assets in `public/json` and `public/media`, served by Vite. Standard commands live in `package.json` and `README.md` / `CLAUDE.md`.

### Toolchain
- Package manager is **Bun** (lockfile `bun.lock`). `bun` is installed under `~/.bun/bin` and is on `PATH` via `~/.bashrc`. If a fresh non-login shell can't find `bun`, run `export PATH="$HOME/.bun/bin:$PATH"`.
- `.env.local` is created from `.env.local.example` by the update script. The app also works with built-in defaults if it's missing.

### Run / build / lint / test
- Dev server: `bun dev` (Vite on port 3000, `--host 0.0.0.0`). Serves the app plus all static JSON/media. This is the only service needed.
- Build: `bun run build` (`tsc -b && vite build`).
- Lint/format: `bun check` (Biome).
- Unit tests: `bun run test --run` (Vitest). Use `bun run test`, NOT `bun test` (the latter invokes Bun's own runner and breaks).
- E2E: `bun test:e2e` (Playwright; it auto-starts the dev server). Requires Playwright browsers (`bunx playwright install`), not installed by the update script.

### Non-obvious caveats
- The dev server sets `Cross-Origin-Embedder-Policy: credentialless` and `Cross-Origin-Opener-Policy: same-origin` headers — these are required for the multi-threaded WebGL engine (web workers + SharedArrayBuffer). Don't strip them when proxying.
- **WebGL rendering needs a real GPU.** In the cloud VM (software WebGL fallback, no dedicated GPU), the app loads and is fully interactive — the central poster cluster renders, hover magnification and click-to-select work — but the surrounding Voronoi background shows stretched/noisy pixel artifacts. This is an environment GPU limitation, not an app bug. Functional verification still works; just don't expect pixel-perfect full-screen rendering in the VM.
- Unit test `app/cmps/common/error-boundary.test.tsx` has a committed snapshot that hardcodes the original author's absolute path inside a React error stack trace, so it fails in any other checkout (paths differ, e.g. `/workspace/...`). This 1 failing snapshot is pre-existing and unrelated to environment setup; the other 57 unit tests pass. Run `bun run test --run -u` only if you intentionally want to refresh that snapshot.
