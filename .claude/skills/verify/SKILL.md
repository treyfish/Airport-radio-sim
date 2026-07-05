---
name: verify
description: Build, launch, and drive Airport Radio Sim in a headless browser to verify changes end-to-end.
---

# Verifying Airport Radio Sim

Static Vite + React app, no backend. Surface = browser GUI.

## Build & serve

```bash
npm install
npm run build                          # tsc -b && vite build → dist/
npx vite preview --port 4173 --strictPort   # serve the production build (run in background)
```

`npm test` runs the core-logic suite (grader/engine/scenario validation) — that's CI, not verification.

## Drive it (Playwright)

Use the pre-installed Chromium; the npm-installed Playwright's own browser
download won't match:

```js
const browser = await chromium.launch({ executablePath: "/opt/pw-browsers/chromium" });
```

Flows worth driving:
1. **Picker**: set callsign (blur to save), toggle "ATC voice" OFF (headless TTS
   is unreliable and slows everything down), check `.locked-tag` level locks.
2. **Scenario**: click a `.scenario-card` → `.briefing` → "Start" button →
   `.cue-banner` appears. Read the active runway out of the cue text — it's
   randomized per run.
3. **Calls**: fill `.text-call input`, click Transmit. Bad call → `.coach-panel`
   items + "say again" bubble. Hint link caps step at 80%. Good calls use the
   pattern `Cedar Valley traffic, Skyhawk <callsign>, <position> runway <rwy>, Cedar Valley`.
4. **Debrief**: `.total-score`, `.step-score` per call, element checklists.
5. **Persistence**: reload → best-score chips, unlocked levels, saved callsign.

## Gotchas

- Runway/ATIS/squawk values are randomized — parse them from the transcript
  bubbles (`.bubble.atc`), never hardcode.
- Voice PTT (SpeechRecognition) can't be exercised headless; text input is the
  equivalent path (same grader, `voiceInput` flag differs only for style notes).
- The radio flow inserts ~250 ms of async event processing between calls —
  `waitForSelector(".cue-banner")` between transmissions.
