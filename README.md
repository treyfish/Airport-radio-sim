# ✈️ Airport Radio Sim

A web-based aviation radio trainer for student pilots. Practice making proper,
professional radio calls — speak into your mic (or type), hear ATC respond with
a synthesized voice and radio static, and get CFI-style feedback on every call:
what you nailed, what you missed, and how a pro would say it.

**No backend, no account, no API keys.** Everything runs in your browser and
your progress is saved locally.

## Levels

Difficulty ramps up with traffic complexity:

| Level | Airspace | You practice |
|---|---|---|
| 1 | Non-towered field (CTAF) | Self-announcing: taxi, departure, pattern legs, inbound, clear-of-runway |
| 2 | Class D tower | ATIS, ground/tower calls, readbacks, hold short, go-arounds, sequencing behind traffic, and the "student pilot toolkit" (radio check / say again slower) |
| 3 | Flight following | Brief call-up, full request, squawk readbacks, radar handoffs — plus declaring a MAYDAY |
| 4 | Class C / B | Clearance delivery, multi-element readbacks, line up and wait, and the Class Bravo transition ("cleared through the Bravo" or you stay out) |

Pass any scenario in a level (70%+) to unlock the next — or use the
"practice anyway" escape hatch.

## Beyond the scenarios

- **📖 Learn mode** — short per-level lessons on the *why* (readback rules,
  LUAW vs cleared-for-takeoff, CRAFT, the Bravo magic words) plus a searchable
  plain-language **glossary** of ~40 radio terms.
- **🎧 Listening drills** — copy the ATIS, copy a Class C clearance
  (heading/altitude/frequency/squawk), and "whose call is it?" — callsign
  discrimination against tail numbers one character off yours.
- **📻 Background traffic** — other aircraft use the frequency while you
  practice, including *distractor* calls addressed to similar callsigns.
  Answer someone else's clearance and the coach catches it; repeat offenses
  show up in a "Frequency discipline" section of your debrief.
- **⏱ Pace & delay coaching** — advisory notes when you hesitate too long
  before keying up or talk much faster/slower than the ~150 wpm controllers
  copy best (never affects your score).
- **📡 Florida UNICOM scanner** — tune any of 25 Florida GA fields and just
  listen to simulated party-line traffic (with an optional "which leg did
  they report?" quiz), plus one-click links to the real feeds on LiveATC.

## Running it

```bash
npm install
npm run dev        # dev server
npm test           # core-logic test suite (grader, engine, all scenario files)
npm run build      # static production build in dist/
```

Voice input uses the Web Speech API (Chrome, Edge, Safari). Firefox users get
an always-available text input instead. ATC voice and radio-static effects can
be toggled off in settings.

## How grading works

Your call is graded **element by element**, not word for word — the required
pieces (who you're calling, who you are, where you are, what you want, and any
mandatory readbacks) can come in any reasonable wording:

1. **Tokenizer/normalizer** converts everything to a canonical form, so
   `N123AB`, "November one two three alpha bravo", and speech-recognition
   output like "november 123 alpha bravo" are all identical. It understands
   `niner`/`tree`/`fife`, "one two eight point three" ↔ `128.3`, the phonetic
   alphabet (including `alfa`/`juliett` spellings), and common recognizer
   manglings ("sessna").
2. **Extractors** find each element with the right amount of fuzz per type —
   runways report the *wrong value you actually said* ("you read back 27, ATC
   said 18"), squawk codes won't match digits inside a frequency, facility
   names tolerate mangled proper nouns but are strict on "tower" vs "ground".
3. **The rubric scorer** weights required elements into a 0–100 score, with
   specific feedback per miss and advisory style notes ("say *niner*, not
   *nine*"; "skip *with you*") that never cost points.

The grader sits behind a single interface (`src/grader/grader.ts` →
`Grader.grade(input, call, env)`), so an AI-backed grader (e.g. Claude API)
can be plugged in later without touching the engine, scenarios, or UI.

## Writing new scenarios

Scenarios are plain JSON files in `src/scenarios/level*/` — no code changes
needed. Add the file, register it in `src/scenarios/index.ts`, done. The test
suite validates every scenario (step graph integrity, template variables,
extractor names) **and plays each one end-to-end** verifying the model call
(`hint`) passes its own rubric across multiple random seeds.

A scenario is a graph of steps:

```jsonc
{
  "id": "my-scenario",
  "level": 2,
  "title": "…",
  "briefing": { "airport": "…", "description": "…", "aircraft": "…",
                "atisText": "…optional…", "frequencies": [{ "name": "Tower", "mhz": "118.3" }] },
  "variables": [                          // randomized per run
    { "name": "callsign", "kind": "callsign" },          // student's saved tail number
    { "name": "rwy", "kind": "choice", "choices": ["13", "31"] },
    { "name": "altimeter", "kind": "range", "range": { "min": 29.85, "max": 30.15, "step": 0.01, "decimals": 2 } }
  ],
  "passingScore": 70,
  "steps": [
    { "id": "clearance", "type": "atcSay", "speaker": "Tower",
      "text": "{callsign}, runway {rwy}, cleared for takeoff.",
      "setsVariables": { "squawk": "{gen:squawk}" },     // values ATC introduces mid-scenario
      "next": "readback" },
    { "id": "readback", "type": "studentCall",
      "prompt": "Read back your takeoff clearance.",
      "hint": "Cleared for takeoff runway {rwy}, {callsign}.",   // the model call — must pass its own rubric
      "call": { "elements": [
        { "id": "runway", "label": "runway readback", "extractor": "runway",
          "expected": "{rwy}", "required": true, "weight": 2,
          "feedbackMissing": "You forgot to read back the runway assignment.",
          "feedbackWrong": "You read back runway {heard}, but you were cleared on runway {rwy}." }
      ] },
      "next": null }                       // null ends the scenario
  ]
}
```

`next` can also be a weighted-random branch list to model ATC variability
(e.g. "cleared for takeoff" vs "hold short, landing traffic"):

```json
"next": [
  { "when": "random", "weight": 2, "goTo": "tower_cleared" },
  { "when": "random", "weight": 1, "goTo": "tower_hold" }
]
```

Available extractors: `facility`, `callsign`, `runway`, `frequency`, `squawk`,
`altitude`, `atis`, `phrase` (in-order fuzzy), `intent` (any-order fuzzy),
`position` (alias of `phrase`).

## Architecture

```
src/
├── types/scenario.ts      scenario schema — single source of truth
├── engine/                step/branch state machine, templates, variables, validator
├── grader/                tokenizer → normalizer → extractors → rubric scorer
├── audio/                 SpeechSynthesis (TTS), SpeechRecognition (PTT), Web Audio radio FX
├── state/                 localStorage persistence (settings + progress)
├── screens/               ScenarioPicker → Briefing → Radio → Debrief
├── components/            Transcript, PTTButton, FrequencyDisplay
└── scenarios/level1..4/   scenario JSON data files
```

## Disclaimer

This is a practice aid for radio *phraseology*, not a source of regulatory or
procedural truth. Phraseology follows the FAA AIM in spirit but is simplified
in places. Always defer to your CFI, the AIM, and the Pilot/Controller Glossary.
