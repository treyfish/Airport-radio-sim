import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioEngine, EngineEvent } from "../engine/scenarioEngine";
import type { StudentCallStep } from "../types/scenario";
import { defaultGrader, type GradeResult } from "../grader/grader";
import { canonicalize } from "../grader/normalizer";
import { extract } from "../grader/extractors";
import { generateChatterCall, chatterIntervalMs, type ChatterCall } from "../engine/chatter";
import { mulberry32 } from "../engine/variables";
import type { Settings } from "../state/persistence";
import { speak, stopSpeaking } from "../audio/tts";
import { playSquelch, unlockAudio } from "../audio/radioFx";
import { recognitionAvailable, startPtt, type PttSession } from "../audio/recognition";
import Transcript, { type TranscriptEntry } from "../components/Transcript";
import PTTButton from "../components/PTTButton";
import FrequencyDisplay from "../components/FrequencyDisplay";

export interface TrapEvent {
  stepId: string;
  yourCall: string;
  theirCallsign: string;
}

interface Props {
  engine: ScenarioEngine;
  settings: Settings;
  onFinish(traps: TrapEvent[]): void;
  onQuit(): void;
}

type PttState = "idle" | "keyed" | "review";

/**
 * Did this transmission engage with a distractor call's content or callsign?
 * When the distractor's content overlaps what the student's own call should
 * contain (`keyAmbiguous`), only an exact match on the WRONG callsign counts —
 * otherwise a merely-imperfect attempt would be misread as a trap.
 */
function matchesDistractor(input: string, distractor: ChatterCall, keyAmbiguous: boolean): boolean {
  const tokens = canonicalize(input);
  if (distractor.distractorCallsign) {
    const cs = canonicalize(distractor.distractorCallsign);
    if (extract("callsign", tokens, cs).exact) return true;
  }
  if (distractor.distractorKey && !keyAmbiguous) {
    const key = canonicalize(distractor.distractorKey);
    if (extract("phrase", tokens, key).found) return true;
  }
  return false;
}

export default function Radio({ engine, settings, onFinish, onQuit }: Props) {
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [prompt, setPrompt] = useState("");
  const [hint, setHint] = useState<string | null>(null);
  const [hintShown, setHintShown] = useState(false);
  const [awaitingCall, setAwaitingCall] = useState(false);
  const [busy, setBusy] = useState(false);
  const [frequency, setFrequency] = useState(engine.scenario.briefing.frequencies[0].mhz);
  const [lastGrade, setLastGrade] = useState<GradeResult | null>(null);
  const [input, setInput] = useState("");
  const [pttState, setPttState] = useState<PttState>("idle");
  const [interim, setInterim] = useState("");
  const pttRef = useRef<PttSession | null>(null);
  const startedRef = useRef(false);
  const voiceInputRef = useRef(false);
  const cueShownAtRef = useRef<number | null>(null);
  const transmissionStartRef = useRef<number | null>(null);
  const pttStartAtRef = useRef<number | null>(null);
  const pttDurationMsRef = useRef<number | null>(null);
  const currentStepRef = useRef<StudentCallStep | null>(null);
  const lastDistractorRef = useRef<ChatterCall | null>(null);
  const chatterRngRef = useRef(mulberry32((Date.now() ^ 0x5f3759df) >>> 1));
  const chatterBusyRef = useRef(false);
  const trapsRef = useRef<TrapEvent[]>([]);
  const hasVoice = recognitionAvailable();

  const append = useCallback((entry: TranscriptEntry) => {
    setEntries((prev) => [...prev, entry]);
  }, []);

  const processEvents = useCallback(
    async (events: EngineEvent[]) => {
      setBusy(true);
      for (const event of events) {
        switch (event.kind) {
          case "atc":
          case "sayAgain": {
            append({ kind: "atc", speaker: event.speaker, text: event.text });
            if (settings.ttsOn && !event.text.startsWith("(")) {
              await speak(event.text, { speaker: event.speaker, fx: settings.fxOn });
            }
            break;
          }
          case "event":
            append({ kind: "event", text: event.text });
            break;
          case "frequency":
            setFrequency(event.mhz);
            break;
          case "awaitCall":
            setPrompt(event.prompt);
            setHint(event.hint);
            setHintShown(false);
            setAwaitingCall(true);
            setBusy(false);
            currentStepRef.current = event.step;
            cueShownAtRef.current = performance.now();
            transmissionStartRef.current = null;
            return;
          case "end":
            setBusy(false);
            setAwaitingCall(false);
            append({ kind: "event", text: "— End of scenario. Heading to your debrief… —" });
            setTimeout(() => onFinish(trapsRef.current), 1200);
            return;
        }
      }
      setBusy(false);
      // reaching here means a say-again or chatter finished while a call is
      // still pending — restart the response-delay clock
      cueShownAtRef.current = performance.now();
      transmissionStartRef.current = null;
    },
    [append, settings, onFinish],
  );

  useEffect(() => {
    if (startedRef.current) return; // guard against StrictMode double-run
    startedRef.current = true;
    void processEvents(engine.advance());
    return () => stopSpeaking();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // --- background traffic ------------------------------------------------
  // While the student is composing a call, other aircraft use the frequency.
  // Some calls are distractors addressed to a similar callsign — answering
  // one is the trap this feature exists to train against.
  useEffect(() => {
    if (!settings.chatterOn || !awaitingCall || busy) return;
    const rng = chatterRngRef.current;
    let cancelled = false;
    const timer = setTimeout(async () => {
      if (cancelled || chatterBusyRef.current || pttState !== "idle") return;
      chatterBusyRef.current = true;
      const call = generateChatterCall(engine.scenario, engine.env, rng);
      if (call.isDistractor) lastDistractorRef.current = call;
      append({ kind: "other", speaker: call.speaker, text: call.text });
      if (settings.ttsOn) {
        setBusy(true); // PTT locked — you don't step on other traffic
        await speak(call.text, { speaker: call.speaker, fx: settings.fxOn });
        if (!cancelled) {
          setBusy(false);
          cueShownAtRef.current = performance.now(); // be fair on the delay clock
        }
      }
      chatterBusyRef.current = false;
    }, chatterIntervalMs(engine.scenario.level, rng));
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.chatterOn, settings.ttsOn, settings.fxOn, awaitingCall, busy, pttState, entries.length]);

  const submit = useCallback(
    (raw: string, viaVoice: boolean) => {
      const text = raw.trim();
      if (!text || !awaitingCall || busy) return;

      // Trap check: did the student answer a call meant for a similar callsign?
      const distractor = lastDistractorRef.current;
      const step = currentStepRef.current;
      if (distractor && step) {
        const pre = defaultGrader.grade(text, step.call, engine.env, { voiceInput: viaVoice });
        const keyAmbiguous = distractor.distractorKey
          ? step.call.elements.some((el) =>
              canonicalize(engine.render(el.expected))
                .join(" ")
                .includes(canonicalize(distractor.distractorKey!).join(" ")),
            )
          : true;
        if (!pre.passed && matchesDistractor(text, distractor, keyAmbiguous)) {
          lastDistractorRef.current = null;
          append({ kind: "you", text });
          setInput("");
          setInterim("");
          setPttState("idle");
          const trap: TrapEvent = {
            stepId: step.id,
            yourCall: text,
            theirCallsign: distractor.distractorCallsign ?? "another aircraft",
          };
          trapsRef.current = [...trapsRef.current, trap];
          append({
            kind: "coach",
            text: `⚠ That call was for ${trap.theirCallsign} — not you. Listen for YOUR callsign before keying up. (Not counted as an attempt.)`,
          });
          cueShownAtRef.current = performance.now();
          return;
        }
      }

      append({ kind: "you", text });
      setInput("");
      setInterim("");
      setPttState("idle");

      const now = performance.now();
      const startedAt = transmissionStartRef.current ?? now;
      const delaySec = cueShownAtRef.current !== null ? (startedAt - cueShownAtRef.current) / 1000 : undefined;
      const words = text.split(/\s+/).length;
      const wpm =
        viaVoice && pttDurationMsRef.current && pttDurationMsRef.current > 500
          ? Math.round(words / (pttDurationMsRef.current / 60000))
          : undefined;
      transmissionStartRef.current = null;
      pttDurationMsRef.current = null;

      const result = engine.submitStudentCall(text, {
        voiceInput: viaVoice,
        timing: { delaySec, wpm },
      });
      setLastGrade(result.grade);
      if (result.advanced) {
        setAwaitingCall(false);
        setLastGrade(null);
        if (result.grade.passed) {
          append({ kind: "coach", text: `✔ Good call — ${result.grade.score}%`, grade: result.grade });
        } else {
          append({
            kind: "coach",
            text: `Moving on (${result.grade.score}%) — check the debrief for what was missing.`,
            grade: result.grade,
          });
        }
        void processEvents(engine.advance());
      } else {
        append({
          kind: "coach",
          text: `That call needs work (${result.grade.score}%). Try again:`,
          grade: result.grade,
        });
        if (result.sayAgain) {
          void processEvents([result.sayAgain]);
        }
      }
    },
    [append, awaitingCall, busy, engine, processEvents],
  );

  // --- push-to-talk ----------------------------------------------------
  const keyUp = useCallback(() => {
    pttRef.current?.stop();
    pttRef.current = null;
  }, []);

  const keyDown = useCallback(() => {
    if (!awaitingCall || busy || pttState === "keyed") return;
    unlockAudio();
    if (settings.fxOn) playSquelch();
    setInterim("");
    setPttState("keyed");
    transmissionStartRef.current = performance.now();
    pttStartAtRef.current = performance.now();
    const session = startPtt({
      onInterim: setInterim,
      onFinal: (text) => {
        if (settings.fxOn) playSquelch();
        pttDurationMsRef.current =
          pttStartAtRef.current !== null ? performance.now() - pttStartAtRef.current : null;
        if (text) {
          setInput(text);
          setPttState("review");
          voiceInputRef.current = true;
        } else {
          setPttState("idle");
        }
      },
      onError: (error) => {
        setPttState("idle");
        append({ kind: "event", text: `⚠ Microphone problem (${error}) — you can type your call instead.` });
      },
    });
    if (!session) {
      setPttState("idle");
      return;
    }
    pttRef.current = session;
  }, [awaitingCall, busy, pttState, settings.fxOn, append]);

  useEffect(() => () => pttRef.current?.abort(), []);

  const showHint = () => {
    if (!hintShown) engine.markHintUsed();
    setHintShown(true);
  };

  return (
    <main className="radio">
      <div className="radio-top">
        <FrequencyDisplay mhz={frequency} />
        <button className="link-btn" onClick={onQuit}>quit scenario</button>
      </div>

      <Transcript entries={entries} />

      {awaitingCall && (
        <div className="cue-banner">
          <span className="cue-label">Your move</span>
          <p>{prompt}</p>
          {hintShown && hint ? (
            <p className="hint-text">💡 “{hint}”</p>
          ) : (
            <button className="link-btn" onClick={showHint}>
              show me the call (caps this step at 80%)
            </button>
          )}
        </div>
      )}

      {lastGrade && awaitingCall && (
        <div className="coach-panel">
          {lastGrade.elements
            .filter((e) => e.status !== "ok" && e.feedback)
            .map((e) => (
              <p key={e.id} className={`coach-item ${e.status}`}>
                {e.status === "wrong" ? "✗" : "…"} {e.feedback}
              </p>
            ))}
        </div>
      )}

      <div className="input-area">
        {hasVoice && (
          <PTTButton
            state={pttState}
            disabled={!awaitingCall || busy}
            interim={interim}
            onKeyDown={keyDown}
            onKeyUp={keyUp}
          />
        )}
        <form
          className="text-call"
          onSubmit={(e) => {
            e.preventDefault();
            const viaVoice = voiceInputRef.current;
            voiceInputRef.current = false;
            submit(input, viaVoice);
          }}
        >
          <input
            value={input}
            disabled={!awaitingCall || busy}
            placeholder={
              pttState === "review"
                ? "Check what the mic heard, then transmit"
                : hasVoice
                  ? "…or type your call here"
                  : "Type your radio call here"
            }
            onChange={(e) => {
              if (transmissionStartRef.current === null && e.target.value.trim()) {
                transmissionStartRef.current = performance.now();
              }
              setInput(e.target.value);
              voiceInputRef.current = false;
            }}
          />
          <button className="primary-btn" disabled={!awaitingCall || busy || !input.trim()}>
            Transmit
          </button>
        </form>
      </div>
    </main>
  );
}
