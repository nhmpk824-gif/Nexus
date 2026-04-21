# Autonomy engine

The companion's inner life: when it feels awake/drowsy/asleep, how it tracks
emotion and the relationship with the user over time, and (eventually) whether
it should proactively speak.

## Where things live

Autonomy logic is deliberately split across three layers:

```
src/features/autonomy/          ← pure engine, no React, no Electron
    emotionModel.ts                  4-dimension emotion state + signal math
    relationshipTracker.ts           score/level/streak over days
    rhythmLearner.ts                 per-hour activity probability learning
    tickLoop.ts                      awake/drowsy/sleeping/dreaming state machine
    focusAwareness.ts                quiet-hours / locked-screen gates
    memoryDream.ts                   nightly consolidation cycle
    goalTracker.ts                   explicit user goals
    proactiveEngine.ts               (LEGACY v1) rule-based decision tree
    innerMonologue.ts                (LEGACY v1) inner-voice LLM calls
    intentPredictor.ts               (LEGACY v1) "what will the user say next"
    contextScheduler.ts              context-triggered task runner
    decisionFeedback.ts              learns from user reactions
    skillDistillation.ts             autoskill extraction
    v2/                          ← NEW, LLM-driven decision engine (Phase 2+)
        contextGatherer.ts           pure signal aggregator

src/app/controllers/            ← React bindings that hold refs + persistence
    useAutonomyController.ts         top-level wiring (529 lines — big because
                                     it glues all the pieces together)
    useEmotionState.ts               emotion ref + persist + signal API
    useRelationshipState.ts          relationship ref + persist
    useRhythmState.ts                rhythm ref + persist + decay

src/hooks/                      ← other React hooks that consume autonomy state
    useAutonomyTick.ts               drives the tick loop at a configurable interval
    useMemoryDream.ts                schedules the nightly dream
    usePetBehavior.ts                maps autonomy state into pet visuals

src/types/autonomy.ts           ← shared type surface (AutonomyTickState,
                                  ProactiveDecision, Goal, etc.)
```

## Layering rule

1. **features/autonomy/** is pure — no React, no IPC, no `window`. Anything
   imported here should work in a plain Node test without mocking.
2. **app/controllers/** owns `useRef`, storage reads/writes, and the
   serialised side-effects the engine triggers (e.g. "emit bus event").
3. **hooks/** is free to consume controllers but shouldn't import engine
   files directly — go through the controller so persistence/state flows
   stay in one place.

Breaking this layering is usually what makes autonomy hard to navigate. If
you find yourself importing `useRef` from `features/autonomy/*`, stop.

## v2 engine (active)

The v2 engine replaced the legacy rule-based decision tree with a small
LLM call gated by the tick loop:

```
tick (eligible?) → gather context → decision LLM → persona guardrail → speak
```

V1 code (`proactiveEngine.ts`, `innerMonologue.ts`, `intentPredictor.ts`,
`decisionFeedback.ts`, `broadcastGate.ts`) was deleted in Phase 6.

## Settings surface

- `autonomyEnabled` — master toggle.
- `autonomyLevelV2` — `off | low | med | high`, tick density and speech rate.
- `autonomyModelV2` — model override, empty means reuse primary chat model.
- `autonomyPersonaStrictnessV2` — `loose | med | strict`, guardrail aggression.

See `src/types/autonomy.ts` for the full `AutonomySettings` interface and
`src/lib/storage/settings.ts` for defaults.
