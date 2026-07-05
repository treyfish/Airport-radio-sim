import { useCallback, useEffect, useRef, useState } from "react";
import type { ScenarioEngine, EngineEvent } from "../engine/scenarioEngine";
import type { GradeResult } from "../grader/grader";
import type { Settings } from "../state/persistence";
import { speak, stopSpeaking } from "../audio/tts";
import { playSquelch, unlockAudio } from "../audio/radioFx";
import { recognitionAvailable, startPtt, type PttSession } from "../audio/recognition";
import Transcript, { type TranscriptEntry } from "../components/Transcript";
import PTTButton from "../components/PTTButton";
import FrequencyDisplay from "../components/FrequencyDisplay";

interface Props {
  engine: ScenarioEngine;
  settings: Settings;
  onFinish(): void;
  onQuit(): void;
}

type PttState = "idle" | "keyed" | "review";

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
            cueShownAtRef.current = performance.now();
            transmissionStartRef.current = null;
            return;
          case "end":
            setBusy(false);
            setAwaitingCall(false);
            append({ kind: "event", text: "— End of scenario. Heading to your debrief… —" });
            setTimeout(onFinish, 1200);
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

  const submit = useCallback(
    (raw: string, viaVoice: boolean) => {
      const text = raw.trim();
      if (!text || !awaitingCall || busy) return;
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
