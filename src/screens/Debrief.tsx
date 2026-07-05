import type { DebriefData } from "../App";

interface Props {
  data: DebriefData;
  onRetry(): void;
  onDone(): void;
}

const STATUS_ICON: Record<string, string> = {
  ok: "✓",
  partial: "◐",
  missing: "✗",
  wrong: "✗",
};

export default function Debrief({ data, onRetry, onDone }: Props) {
  const { scenario, results, totalScore, passed } = data;

  return (
    <main className="debrief">
      <section className={`score-banner card ${passed ? "pass" : "fail"}`}>
        <h2>{passed ? "Nicely done, pilot. 🛬" : "Good practice — let's tighten it up."}</h2>
        <div className="total-score">{totalScore}%</div>
        <p>
          {scenario.title} · pass mark {scenario.passingScore}% ·{" "}
          {passed ? "PASSED" : "not passed yet"}
        </p>
        <div className="debrief-actions">
          <button className="primary-btn" onClick={onRetry}>Fly it again</button>
          <button className="link-btn" onClick={onDone}>back to scenarios</button>
        </div>
      </section>

      {results.map((r) => {
        const lastAttempt = r.attempts[r.attempts.length - 1];
        return (
          <section key={r.stepId} className="call-card card">
            <header>
              <h3>{r.prompt}</h3>
              <span className={`step-score ${r.finalScore >= 70 ? "pass" : "fail"}`}>
                {r.finalScore}%{r.hintUsed ? " (hint used)" : ""}
                {r.attempts.length > 1 ? ` · ${r.attempts.length} attempts` : ""}
              </span>
            </header>

            <p className="you-said">
              <strong>You said:</strong> “{lastAttempt?.input ?? "—"}”
              {lastAttempt?.timing && (lastAttempt.timing.delaySec !== undefined || lastAttempt.timing.wpm) && (
                <span className="timing">
                  {lastAttempt.timing.delaySec !== undefined &&
                    ` · responded in ${lastAttempt.timing.delaySec.toFixed(1)} s`}
                  {lastAttempt.timing.wpm ? ` · ~${lastAttempt.timing.wpm} wpm` : ""}
                </span>
              )}
            </p>

            <ul className="element-checklist">
              {r.bestGrade.elements.map((e) => (
                <li key={e.id} className={`element ${e.status}`}>
                  <span className="status-icon">{STATUS_ICON[e.status]}</span>
                  <span className="element-label">{e.label}</span>
                  {e.feedback && e.status !== "ok" && (
                    <span className="element-feedback">{e.feedback}</span>
                  )}
                </li>
              ))}
            </ul>

            {r.bestGrade.styleNotes.length > 0 && (
              <ul className="style-notes">
                {r.bestGrade.styleNotes.map((note, i) => (
                  <li key={i}>💬 {note}</li>
                ))}
              </ul>
            )}

            <p className="model-call">
              <strong>Model call:</strong> “{r.hint}”
            </p>
          </section>
        );
      })}
    </main>
  );
}
