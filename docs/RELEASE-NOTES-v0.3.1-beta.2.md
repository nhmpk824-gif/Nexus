# Nexus v0.3.1-beta.2

> **Pre-release.** Security-only patch on top of v0.3.1-beta.1 — **no behavior changes, no new features**. Beta channel because we want real-world validation that the new SSRF / rate-limit gates don't break legitimate local-provider workflows (Ollama on 127.0.0.1, LM Studio on LAN, the doctor panel) before promoting to stable v0.3.1.

## Why this exists

A two-pass security audit on the IPC surface (2026-04-24 → 2026-04-26) found that several renderer-facing IPC handlers passed user-controlled strings to `net.fetch` / `nodeNet.createConnection` / vault reads with insufficient gating. Each of these is exploitable only from a *compromised* renderer (XSS in chat-rendered content, hostile plugin page) — not remotely zero-interaction — but Nexus is a desktop app that holds API keys and runs as the user, so the blast radius if any of them did get triggered is large.

The 2026-04-24 sweep landed fixes for **H2, H3, H6, H7** in the v0.3.0 cycle. This release lands the remaining three.

## What this fixes

### H5 — chat baseUrl SSRF (closed)

`chat:complete`, `chat:complete-stream`, `chat:test-connection`, and `service:test-connection` now run the renderer-supplied `baseUrl` through `checkChatBaseUrlSafety` before any `net.fetch`. Refuses:

- `http://169.254.169.254/...` and other IMDS metadata hosts (AWS / GCP / Azure)
- `http://0.0.0.0/...` and the `0.0.0.0/8` range
- `file://`, `gopher://`, `data:`, etc. — any non-`http(s)` scheme

Loopback (`127.0.0.1:11434`) and RFC1918 LAN ranges remain usable for legitimate local-provider workflows.

### H4 — vault slow-burn enumeration (mitigated, not closed)

`vault:retrieve` (single-slot) gains a per-sender **3 calls / 60 s** ceiling, audited on hit. The legitimate renderer never calls single-slot retrieve directly — settings hydration always goes through `vault:retrieve-many`, which already has its own bulk-op limit. The strict ceiling closes the gap where an attacker could enumerate every secret one slot at a time below the bulk threshold.

The fully-architectural fix (opaque vault handles resolved only at outbound IPC boundaries, so the renderer never sees plaintext) is deferred — it requires changing every consumer of API keys in the codebase and is out of scope for a stability-first patch release.

### H8 — local-service probe port-scan (closed)

`doctor:probe-local-services` previously accepted any `host` string from the renderer and made parallel `nodeNet.createConnection` attempts, returning per-target latency and error codes — a clean SSRF timing oracle against the user's LAN that bypassed the URL-safety gate (because it never went through `net.fetch`).

Two layers:

- Host pinned to a `{127.0.0.1, localhost, ::1}` allowlist before any TCP connect; anything else silently rewrites to `127.0.0.1`.
- IPC handler caps the input array to 16 targets — the doctor panel never legitimately probes more.

The doctor panel's only documented use is "is Ollama / LM Studio up on this loopback port?" so the allowlist costs nothing.

## Verified clean

The follow-up audit walked every `ipcMain.handle` in `electron/ipc/*` (≈145 channels) and confirmed:

- All handlers call `requireTrustedSender(event)`.
- Preload exposes a typed API surface only — no generic `ipcRenderer.invoke` passthrough.
- `webPreferences = { contextIsolation: true, nodeIntegration: false, sandbox: true }` on both windows.
- `RUNTIME_STATE_SCHEMA` allowlist + 256-char string clamp blocks H6-class injection.
- `mcpHost` stdin is JSON-only; stdout is line-split + `JSON.parse`, no `eval` / `Function`.
- Renderer has zero `dangerouslySetInnerHTML` / `eval` / `new Function` (`grep`-clean across `src/`).

## Known follow-ups (deferred, not blocking)

- **M2** — `tool:open-external` does not gate on its own `requiresConfirmation` policy flag. Risk is small (URL is already restricted to `https?:` via `normalizeExternalUrl`) but the contract is broken; will be tightened when the tool registry next gets a pass.
- **H4 full architecture** — opaque-handle vault rework (estimated 1–2 days) deferred. The 3 / 60 s ceiling makes pure enumeration impractical in any realistic attack window.

## Backward compatibility

Zero. No data formats, persona schemas, settings shapes, or IPC method signatures changed. Anyone whose chat baseUrl pointed at `169.254.169.254` or `0.0.0.0` (you would know) will get a clear error instead of a silent fetch — that's a behavior change but only for configurations that were unsafe to begin with.

## Auto-update

This is a pre-release on the GitHub Releases page. Stable v0.3.0 users **do not** auto-update to it (electron-updater's "latest release" API excludes pre-releases). Anyone who installed v0.3.1-beta.1 will auto-upgrade to this build on next launch (semver, same `0.3.1` track).

## How to try it

1. Download from the [v0.3.1-beta.2 release page](https://github.com/FanyinLiu/Nexus/releases/tag/v0.3.1-beta.2).
2. Unsigned build, same as previous betas:
   - **macOS**: `xattr -dr com.apple.quarantine /Applications/Nexus.app`
   - **Windows**: SmartScreen "More info → Run anyway"
3. Existing v0.3.x install data is picked up unchanged.

## What we want validated before stable v0.3.1

- ✅ Local providers (Ollama on `127.0.0.1`, LM Studio on `192.168.x.x`) still connect
- ✅ The doctor / diagnostics panel still detects local services correctly
- ✅ Settings save → restart → all stored API keys still hydrate
- ✅ Wake word, ASR, VAD all still load (carry-over from beta.1)

If any of these regress, file an issue against `v0.3.1-beta.2` and we hold the stable promotion.

---

Full commit log between `v0.3.1-beta.1` and `v0.3.1-beta.2`: [compare](https://github.com/FanyinLiu/Nexus/compare/v0.3.1-beta.1...v0.3.1-beta.2).
