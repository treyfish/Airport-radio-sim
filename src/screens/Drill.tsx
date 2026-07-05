import { useEffect, useRef, useState } from "react";
import type { DrillSpec, DrillRound, CopyRound, DiscriminationRound } from "../drills/drills";
import { makeRound, checkAnswer } from "../drills/drills";
import type { Settings } from "../state/persistence";
import { speak, ttsAvailable } from "../audio/tts";
import { unlockAudio } from "../audio/radioFx";

interface Props {
  spec: DrillSpec;
  settings: Settings;
  onDone(score: number): void; // records best score
  onBack(): void;
}

export default function Drill({ spec, settings, onDone, onBack }: Props) {
  const [round, setRound] = useState<DrillRound>(() => makeRound(spec, settings.callsign));
  const canSpeak = ttsAvailable() && settings.ttsOn;

  return (
    <main className="drill card">
      <button className="link-btn" onClick={onBack}>← back</button>
      <h2>{spec.icon} {spec.title}</h2>
      <p className="drill-desc">{spec.description}</p>
      {round.kind === "copy" ? (
        <CopyDrill
          key={JSON.stringify(round.fields.map((f) => f.expected))}
          round={round}
          canSpeak={canSpeak}
          fxOn={settings.fxOn}
          onScore={onDone}
          onNewRound={() => setRound(makeRound(spec, settings.callsign))}
        />
      ) : (
        <DiscriminationDrill
          key={round.calls.map((c) => c.text).join("|")}
          round={round}
          canSpeak={canSpeak}
          fxOn={settings.fxOn}
          onScore={onDone}
          onNewRound={() => setRound(makeRound(spec, settings.callsign))}
        />
      )}
    </main>
  );
}

// ---------------------------------------------------------------- copy drill

function CopyDrill({
  round,
  canSpeak,
  fxOn,
  onScore,
  onNewRound,
}: {
  round: CopyRound;
  canSpeak: boolean;
  fxOn: boolean;
  onScore(score: number): void;
  onNewRound(): void;
}) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [results, setResults] = useState<Record<string, boolean> | null>(null);
  const [plays, setPlays] = useState(0);
  const [flash, setFlash] = useState(false); // text fallback when TTS is off
  const flashTimer = useRef<number | undefined>(undefined);

  const play = () => {
    unlockAudio();
    setPlays((n) => n + 1);
    if (canSpeak) {
      void speak(round.transmission, { speaker: round.speaker, fx: fxOn });
    } else {
      setFlash(true);
      window.clearTimeout(flashTimer.current);
      flashTimer.current = window.setTimeout(() => setFlash(false), 5000);
    }
  };

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  const check = () => {
    const res: Record<string, boolean> = {};
    for (const field of round.fields) {
      res[field.key] = checkAnswer(answers[field.key] ?? "", field.expected);
    }
    setResults(res);
    const correct = Object.values(res).filter(Boolean).length;
    onScore(Math.round((correct / round.fields.length) * 100));
  };

  const score = results
    ? Math.round((Object.values(results).filter(Boolean).length / round.fields.length) * 100)
    : null;

  return (
    <div className="copy-drill">
      <div className="drill-playbar">
        <button className="primary-btn" onClick={play}>
          {plays === 0 ? "▶ Play transmission" : "↻ Replay"}
        </button>
        {plays > 1 && <span className="replay-count">{plays} plays</span>}
      </div>
      {flash && (
        <p className="flash-text">
          <em>{round.speaker}: “{round.transmission}”</em>
        </p>
      )}

      <div className="drill-fields">
        {round.fields.map((field) => (
          <label key={field.key} className="field">
            <span>
              {field.label}
              {results && (
                <strong className={results[field.key] ? "field-ok" : "field-bad"}>
                  {results[field.key] ? " ✓" : ` ✗ (${field.expected})`}
                </strong>
              )}
            </span>
            <input
              value={answers[field.key] ?? ""}
              placeholder={field.placeholder}
              disabled={results !== null}
              onChange={(e) => setAnswers({ ...answers, [field.key]: e.target.value })}
            />
          </label>
        ))}
      </div>

      {results === null ? (
        <button className="primary-btn" disabled={plays === 0} onClick={check}>
          Check my copy
        </button>
      ) : (
        <div className="drill-result">
          <p className="drill-score">
            {score}% {plays > 1 ? `· ${plays} plays` : "· first listen"}
          </p>
          <button className="primary-btn" onClick={onNewRound}>Another one</button>
        </div>
      )}
    </div>
  );
}

// ------------------------------------------------------- discrimination drill

function DiscriminationDrill({
  round,
  canSpeak,
  fxOn,
  onScore,
  onNewRound,
}: {
  round: DiscriminationRound;
  canSpeak: boolean;
  fxOn: boolean;
  onScore(score: number): void;
  onNewRound(): void;
}) {
  const [index, setIndex] = useState(-1); // -1 = not started
  const [answers, setAnswers] = useState<boolean[]>([]);
  const [played, setPlayed] = useState(false);

  const current = index >= 0 && index < round.calls.length ? round.calls[index] : null;
  const finished = index >= round.calls.length;

  const playCurrent = (i: number) => {
    unlockAudio();
    setPlayed(false);
    const call = round.calls[i];
    if (canSpeak) {
      void speak(call.text, { speaker: "ATC", fx: fxOn }).then(() => setPlayed(true));
    } else {
      setPlayed(true);
    }
  };

  const start = () => {
    setIndex(0);
    playCurrent(0);
  };

  const answer = (mine: boolean) => {
    if (!current) return;
    const next = [...answers, mine === current.isMine];
    setAnswers(next);
    const nextIndex = index + 1;
    setIndex(nextIndex);
    if (nextIndex < round.calls.length) {
      playCurrent(nextIndex);
    } else {
      onScore(Math.round((next.filter(Boolean).length / round.calls.length) * 100));
    }
  };

  return (
    <div className="discrimination-drill">
      <p className="your-callsign-reminder">
        Your callsign: <strong className="mono">{round.callsign}</strong>
      </p>
      {index === -1 && (
        <button className="primary-btn" onClick={start}>▶ Start — 8 calls</button>
      )}
      {current && (
        <div className="disc-round">
          <p className="disc-count">Call {index + 1} of {round.calls.length}</p>
          {canSpeak ? (
            <button className="link-btn" onClick={() => playCurrent(index)}>↻ replay</button>
          ) : (
            <p className="flash-text"><em>“{current.text}”</em></p>
          )}
          <div className="disc-buttons">
            <button className="primary-btn" disabled={!played && canSpeak} onClick={() => answer(true)}>
              📻 My call
            </button>
            <button className="primary-btn secondary" disabled={!played && canSpeak} onClick={() => answer(false)}>
              Not mine
            </button>
          </div>
          {answers.length > 0 && (
            <p className="disc-feedback">{answers[answers.length - 1] ? "✓ correct" : "✗ missed that one"}</p>
          )}
        </div>
      )}
      {finished && (
        <div className="drill-result">
          <p className="drill-score">
            {Math.round((answers.filter(Boolean).length / round.calls.length) * 100)}% —{" "}
            {answers.filter(Boolean).length} of {round.calls.length}
          </p>
          <button className="primary-btn" onClick={onNewRound}>Another round</button>
        </div>
      )}
    </div>
  );
}
