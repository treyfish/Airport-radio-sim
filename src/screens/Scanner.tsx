// Scanner: tune a Florida CTAF/UNICOM and just listen. Simulated traffic is
// generated in-app; real audio opens LiveATC in their own player (their
// terms of use prohibit embedding streams in third-party apps).

import { useEffect, useRef, useState } from "react";
import { FLORIDA_AIRPORTS, type FloridaAirport } from "../content/floridaAirports";
import { generateUnicomCall } from "../engine/chatter";
import { mulberry32 } from "../engine/variables";
import type { Settings } from "../state/persistence";
import { speak, stopSpeaking, ttsAvailable } from "../audio/tts";
import { unlockAudio } from "../audio/radioFx";
import FrequencyDisplay from "../components/FrequencyDisplay";
import Transcript, { type TranscriptEntry } from "../components/Transcript";

interface Props {
  settings: Settings;
  onBack(): void;
}

const LEGS = ["taxi", "departing", "crosswind", "downwind", "base", "final", "inbound", "clear of the runway"];

export default function Scanner({ settings, onBack }: Props) {
  const [airport, setAirport] = useState<FloridaAirport>(FLORIDA_AIRPORTS[0]);
  const [listening, setListening] = useState(false);
  const [quizOn, setQuizOn] = useState(false);
  const [entries, setEntries] = useState<TranscriptEntry[]>([]);
  const [quiz, setQuiz] = useState<{ answer: string; result?: boolean } | null>(null);
  const [quizScore, setQuizScore] = useState({ right: 0, total: 0 });
  const rngRef = useRef(mulberry32((Date.now() ^ 0x2c1b3c6d) >>> 1));
  const runningRef = useRef(false);
  const quizRef = useRef<{ answer: string } | null>(null);
  const canSpeak = ttsAvailable() && settings.ttsOn;

  const stop = () => {
    runningRef.current = false;
    setListening(false);
    stopSpeaking();
  };

  useEffect(() => stop, []); // eslint-disable-line react-hooks/exhaustive-deps

  const loop = async (current: FloridaAirport) => {
    const rng = rngRef.current;
    while (runningRef.current) {
      if (quizRef.current) {
        // waiting for a quiz answer — idle until answered
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      const call = generateUnicomCall({ name: current.name.split("(")[0].trim(), runways: current.runways }, rng);
      setEntries((prev) => [...prev.slice(-30), { kind: "other", speaker: call.speaker, text: call.text }]);
      if (canSpeak) {
        await speak(call.text, { speaker: call.speaker, fx: settings.fxOn });
      }
      if (!runningRef.current) return;
      if (quizOnRef.current && rng() < 0.3) {
        quizRef.current = { answer: call.leg };
        setQuiz({ answer: call.leg });
        continue;
      }
      await new Promise((r) => setTimeout(r, (2 + rng() * 6) * 1000));
    }
  };

  // keep quizOn readable inside the loop without restarting it
  const quizOnRef = useRef(quizOn);
  quizOnRef.current = quizOn;

  const start = () => {
    unlockAudio();
    setEntries([]);
    setQuiz(null);
    quizRef.current = null;
    runningRef.current = true;
    setListening(true);
    void loop(airport);
  };

  const answerQuiz = (leg: string) => {
    if (!quiz) return;
    const right = leg === quiz.answer;
    setQuizScore((s) => ({ right: s.right + (right ? 1 : 0), total: s.total + 1 }));
    setQuiz({ ...quiz, result: right });
    setTimeout(() => {
      setQuiz(null);
      quizRef.current = null;
    }, 1600);
  };

  return (
    <main className="scanner">
      <button className="link-btn" onClick={() => { stop(); onBack(); }}>← back</button>
      <h2>📡 Florida UNICOM scanner</h2>
      <p className="drill-desc">
        Pick a field and listen to the party line — the fastest way to absorb the rhythm of CTAF
        calls. Quiz mode checks whether you're really hearing the position reports.
      </p>

      <div className="scanner-controls">
        <select
          value={airport.icao}
          disabled={listening}
          onChange={(e) => {
            const next = FLORIDA_AIRPORTS.find((a) => a.icao === e.target.value);
            if (next) setAirport(next);
          }}
        >
          {FLORIDA_AIRPORTS.map((a) => (
            <option key={a.icao} value={a.icao}>
              {a.name} ({a.icao}) — {a.city} · CTAF {a.ctaf}
            </option>
          ))}
        </select>
        <FrequencyDisplay mhz={airport.ctaf} />
      </div>

      <div className="scanner-actions">
        {listening ? (
          <button className="primary-btn danger" onClick={stop}>■ Stop</button>
        ) : (
          <button className="primary-btn" onClick={start}>▶ Listen (simulated traffic)</button>
        )}
        <label className="quiz-toggle">
          <input type="checkbox" checked={quizOn} onChange={(e) => setQuizOn(e.target.checked)} />
          Quiz me while I listen
        </label>
        <a
          className="link-btn"
          href={`https://www.liveatc.net/search/?icao=${airport.icao}`}
          target="_blank"
          rel="noreferrer"
        >
          Listen to the real thing on LiveATC ↗
        </a>
      </div>

      {quizScore.total > 0 && (
        <p className="quiz-score">Quiz: {quizScore.right}/{quizScore.total} correct</p>
      )}

      {quiz && (
        <div className="cue-banner">
          <span className="cue-label">Quiz</span>
          {quiz.result === undefined ? (
            <>
              <p>What did that last aircraft report?</p>
              <div className="quiz-options">
                {LEGS.map((leg) => (
                  <button key={leg} className="primary-btn secondary quiz-btn" onClick={() => answerQuiz(leg)}>
                    {leg}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p>{quiz.result ? "✓ Correct!" : `✗ It was: ${quiz.answer}`}</p>
          )}
        </div>
      )}

      <Transcript entries={entries} />

      <p className="disclaimer">
        Frequencies are practice references only and change over time — always verify with the
        current FAA Chart Supplement before real-world use. Simulated traffic is fictional.
      </p>
    </main>
  );
}
