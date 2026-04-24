# Nexus v0.3.0-beta.2

> **Pre-release.** Same channel as v0.3.0-beta.1 — GitHub treats it as a pre-release, the auto-updater on stable installs ignores it. Beta users on `v0.3.0-beta.1` will get this build automatically next launch. Stable users (≤ v0.2.9) stay where they are until `v0.3.0` ships.

This build is a **stability + retention pass** on top of beta.1. The relationship/emotional system from beta.1 stayed intact; what landed this round is everything around it — the panel UI, the autonomy decision engine, memory recall, weather precision, tray + dock visuals.

45 commits between beta.1 and beta.2, ~6,000 LOC delta, **+158 unit tests** (665 → 823).

---

## For users — what you'll notice

### 1. The companion remembers, and shows it

Three closely related changes ship together as a "memory does work" story:

- **Significance-weighted recall.** Memories formed under high emotional load (high arousal, extreme valence, heavy concern) now resurface up to 40% more readily than calm-equivalent memories. The decay curve and pinned-tier semantics are unchanged — this is purely a ranking multiplier.
- **Reflection store.** During the dream cycle, the companion now generates 1–3 short observations about you ("user codes late at night," "user gets quiet on Mondays"). They're stored as a new `reflection` memory tier, capped at 20, deduped by topic. Autonomy reads them when deciding how to behave.
- **Callback moments.** Following the same dream cycle, 0–2 high-value memories get queued for "next conversation or two" surfacing. The next chat turn passes them as a soft hint to the LLM, asking it to gently weave one in if natural — and emit a `[recall:<id>]` tag inline so the chat layer knows. Backend infrastructure ships first; the visible "recalled from <date>" badge is a follow-up.

### 2. First impressions feel less generic

Two new patterns nudge early conversations toward something specific:

- On the **2nd or 3rd assistant reply ever**, a system-prompt addendum asks the LLM to end its reply with one short curious question rooted in a concrete detail from the persona / about-you file. Not "what hobbies do you have?" — more "you mentioned rainy Sundays in your hometown — what did those smell like?"
- **Anniversary milestones** (`days-30`, `days-100`, `days-365`) fire as one-shot hints to the prompt — explicit permission to mention the moment once, gently, with permission to skip if not natural. No confetti UI.

### 3. The companion is alive in the corner

The autonomy V2 decision engine gained a fourth action: `idle_motion`. When you've been idle for 3+ minutes, the engine may choose to fire a silent Live2D gesture — a stretch, a yawn, a head-tilt — with no chat bubble, no TTS. Just the pet visibly being there.

The engine itself runs at a **dynamic cadence** now: faster checks when mood is high-arousal and the relationship is close, slower when sleeping/drowsy or after long idle. Same per-level cost ceiling as before — the cadence floats around it instead of being fixed.

### 4. Liquid Glass UI re-skin

The bubble + composer aesthetic shifted to an iOS-26-style violet accent: user messages in a soft purple gradient on dark text, primary buttons (send) in a matching gradient, links and scrollbar thumbs in violet. **Surfaces stay neutral dark** — the violet is an accent only, the panel itself isn't tinted. Re-skin only; no structural change to layout, no per-locale persona names, no Dynamic-Island state pill.

The chat panel toolbar got cleaned up: weather chip now sits flush left, three buttons on the right, a redundant connection-status sentence and the green online-dot were removed. The empty-chat welcome top-aligns with a time-aware bouncing emoji (☀️/⛅/🌇/🌙) and a gently pulsing ✨ on the body line.

### 5. Tray + dock icons

Brand-new line-art portrait — anime profile with headphones inside an orbit ring. Tray template (macOS menu bar) is rendered as a thick black-line silhouette using a two-stage dilate-then-downsample pipeline so it reads at 22px without smudging. Dock + Windows installer use the colored "Variant G" version: peach→violet linear gradient with cream line work and a macOS-style squircle mask.

### 6. Weather is materially more precise

Old summary collapsed to one daily code per day ("today: scattered showers"). New summary pulls **richer current fields** (humidity, feels-like temperature, current precipitation in mm), **12-hour hourly forecast** for intra-day shifts ("rain starting around 6 PM, ~70% chance"), and adds **day-after-tomorrow** forecast. All from open-meteo's free API — no key required.

### 7. Onboarding

The Welcome step gained a UI language picker so a non-Chinese user on a mismatched OS locale can switch the interface during the wizard rather than after. After finishing onboarding, the chat now seeds a localized first-meeting greeting (5 locales) so the assistant bubble area isn't empty on first open.

### 8. Other improvements

- Inline LLM expression tags expanded to support `[motion:wave|nod|shake|tilt|point]` (drives Live2D motion groups, not just expressions). Documented in 5 locales.
- Lorebook semantic recall can opt into a **query-rewrite fallback** — when the literal pass returns no hits, a cheap LLM rewrites the user message into 2–3 alternative phrasings and re-runs the search. Off by default.
- Diagnostics: structured logger with JSONL export, an emotion + relationship state-timeline panel, and a 30-day cost-history bar chart with per-source / per-model breakdowns.
- Subagent UX: cancel button + history panel for the last 25 terminal tasks.
- Voice pipeline: 10+ stability fixes (timing races, leak cleanup, restart-count resets) — fewer "stuck listening" / "ghost session" reports.
- 7 high-severity security fixes from a multi-agent main-process audit (MCP approval ledger, notification-bridge SSRF, vault-enumeration rate limit, chat-baseUrl IP filter, runtime-state IPC schema validation, chat-stream done-frame on error).

---

## For developers

### Module additions

- `src/features/memory/callbackStore.ts` — pending-callback queue with TTL.
- `src/features/memory/reflectionGenerator.ts` — `selectCallbackCandidates`, `mergeReflections`, JSON parser for the dream-cycle reflection LLM call.
- `src/features/autonomy/milestones.ts` — anniversary milestone detector + `markMilestoneFired` (state-mutating helper).
- `electron/services/mcpApprovals.js` + `mcpApprovalsHash.js` — per-server approval ledger with `awaiting_approval` state.
- `electron/services/urlSafety.js` — strict (`checkUrlSafety`) + permissive (`checkChatBaseUrlSafety`) IP-filter helpers, used by RSS bridge + chat baseUrl validation.
- `src/lib/logger.ts` — 500-entry ring buffer with JSONL export.
- `src/features/autonomy/stateTimeline.ts` — emotion + relationship sample storage with delta-trigger gating.

### Decision engine V2 additions

- `DecisionResult.kind = 'idle_motion'` — silent gesture, bypasses the persona guardrail (no text to judge).
- `computeConsiderationCadence(level, signals)` — replaces the fixed `ticksBetweenConsiderations` with a dynamic multiplier scaled by phase / energy / curiosity / idle / relationship score; clamped to `[2, 3*base]` so cost limits hold.
- `responseContractIdleMotion` per-locale prompt copy gated by `allowIdleMotion` hint.

### Tag protocol expansion

`extractPerformanceTags` (formerly `extractExpressionOverrides`) now parses four keys:
- `[expr:X]` — one-shot Live2D expression
- `[motion:X]` — Live2D motion group via `gestures` map
- `[tts:X]` — collected and dropped (placeholder for future emotion-TTS adapter)
- `[recall:<memId>]` — case-preserved memory id; assistantReply consumes from callback queue when emitted

### Storage / type changes

- `MemoryItem` gains `significance?: number`, `reflectionTopic?`, `reflectionConfidence?`.
- `MemoryImportance` gains `'reflection'` tier (seed score 0.6).
- `RelationshipState` gains `firedMilestoneKeys?: string[]`.
- `WeatherLookupResponse` gains `currentApparentTemperature`, `currentHumidity`, `currentPrecipitationMm`, `currentIsDay`, `dayAfterSummary`, `upcomingHourly`.
- `MeterSource` gains `'reflection'`.
- All additions are optional fields — pre-beta.1 stored state migrates transparently.

### CSS tokens

Adopted Liquid Glass design palette in `tokens.ts` — same 14-token interface, accent colors shifted to `#A88BFF` (violet) family. Surfaces in both `defaultThemeTokens` and `systemDarkThemeTokens` revert to neutral; only accent + accent-soft / hover are violet.

### Tests

665 → 823 (+158). New coverage: significance computation, callback selection, reflection generation, anniversary milestones, performance-tag parser (motion/recall variants), dynamic cadence, lorebook query rewrite, callback-store CRUD, idle_motion parser/gating.

---

## Backward compatibility

- localStorage: every new field on `MemoryItem` / `RelationshipState` / `WeatherLookupResponse` is optional. Pre-beta.1 state loads unchanged.
- Auto-update: pre-release channel; stable users stay on `v0.2.9`.
- Persona files (SOUL.md / lorebook): unchanged schema.

## Breaking changes

None.

## Known issues

- `lorebookRewriteQueryEnabled` setting exists but no Settings UI toggle — enable via DevTools localStorage hack until the next round.
- Idle motion runs only on per-model gestures. Built-in `mao` model maps all five public gestures (wave/nod/shake/tilt/point) to its single `TapBody` group; imported models with richer libraries can declare per-gesture groups.
- One pre-existing `react-hooks/exhaustive-deps` warning in `useAppController.ts:386` remains.

## How to try it

1. Download the `v0.3.0-beta.2` installer from the [releases page](https://github.com/FanyinLiu/Nexus/releases/tag/v0.3.0-beta.2).
2. Unsigned build — on first launch:
   - **macOS**: `xattr -dr com.apple.quarantine /Applications/Nexus.app`
   - **Windows**: SmartScreen "More info → Run anyway"
3. Existing v0.3.0-beta.1 install data is picked up unchanged.
4. Beta users auto-update on next launch when stable v0.3.0 ships (semver-aware: `0.3.0 > 0.3.0-beta.2`).

## Feedback

Particularly interested in:
- Does the **callback** moment ("did you ever pick a gift?") fire when it should? Too often / too rare?
- Does the new **idle motion** read as "alive" or as "twitchy"?
- Anniversary milestones — does day-30 / day-100 actually land, or does the LLM ignore the hint?
- Weather precision — is the new "傍晚 18 点起可能有降水" hint actually right?

- Bugs: [GitHub Issues](https://github.com/FanyinLiu/Nexus/issues)
- Discussion: [Q&A](https://github.com/FanyinLiu/Nexus/discussions/categories/q-a)

---

Full commit log between `v0.3.0-beta.1` and `v0.3.0-beta.2`: [compare](https://github.com/FanyinLiu/Nexus/compare/v0.3.0-beta.1...v0.3.0-beta.2).
