import { useState } from "react";
import type { Scenario } from "../types/scenario";
import { scenarios, scenariosByLevel, LEVEL_TITLES } from "../scenarios";
import { levelUnlocked, type PersistedState, type Settings } from "../state/persistence";
import { DRILLS, type DrillSpec } from "../drills/drills";

interface Props {
  persisted: PersistedState;
  onPick(scenario: Scenario): void;
  onSettingsChange(settings: Settings): void;
  onLearn(level: number): void;
  onDrill(spec: DrillSpec): void;
  onScanner(): void;
}

const scenarioLevels = new Map(scenarios.map((s) => [s.id, s.level as number]));

export default function ScenarioPicker({ persisted, onPick, onSettingsChange, onLearn, onDrill, onScanner }: Props) {
  const { settings, progress } = persisted;
  const [callsignDraft, setCallsignDraft] = useState(settings.callsign);

  const commitCallsign = () => {
    const cleaned = callsignDraft.trim().toUpperCase();
    setCallsignDraft(cleaned);
    onSettingsChange({ ...settings, callsign: cleaned });
  };

  return (
    <main className="picker">
      <section className="setup card">
        <h2>Your aircraft</h2>
        <label className="field">
          <span>Callsign (tail number)</span>
          <input
            value={callsignDraft}
            placeholder="N123AB — leave blank for random"
            onChange={(e) => setCallsignDraft(e.target.value)}
            onBlur={commitCallsign}
            maxLength={7}
          />
        </label>
        <div className="toggles">
          <label>
            <input
              type="checkbox"
              checked={settings.ttsOn}
              onChange={(e) => onSettingsChange({ ...settings, ttsOn: e.target.checked })}
            />
            ATC voice (text-to-speech)
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.fxOn}
              onChange={(e) => onSettingsChange({ ...settings, fxOn: e.target.checked })}
            />
            Radio static effects
          </label>
          <label>
            <input
              type="checkbox"
              checked={settings.chatterOn}
              onChange={(e) => onSettingsChange({ ...settings, chatterOn: e.target.checked })}
            />
            Background traffic on frequency
          </label>
        </div>
      </section>

      <section className="level-section">
        <h2>📡 Scanner</h2>
        <div className="scenario-grid">
          <button className="scenario-card card" onClick={onScanner}>
            <span className="scenario-title">📡 Florida UNICOM scanner</span>
            <span className="scenario-airport">
              Tune a Florida CTAF and just listen — simulated party-line traffic, plus links to the
              real thing on LiveATC.
            </span>
          </button>
        </div>
      </section>

      <section className="level-section">
        <h2>🎧 Listening drills</h2>
        <div className="scenario-grid">
          {DRILLS.map((spec) => {
            const p = progress[`drill:${spec.id}`];
            return (
              <button key={spec.id} className="scenario-card card" onClick={() => onDrill(spec)}>
                <span className="scenario-title">{spec.icon} {spec.title}</span>
                <span className="scenario-airport">{spec.description}</span>
                {p && (
                  <span className="scenario-meta">
                    <span className={`best-score ${p.passed ? "pass" : ""}`}>
                      best {p.bestScore}%{p.passed ? " ✓" : ""}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </section>

      {[...scenariosByLevel().entries()].map(([level, list]) => {
        const unlocked = levelUnlocked(level, persisted, scenarioLevels);
        return (
          <section key={level} className="level-section">
            <h2>
              {LEVEL_TITLES[level] ?? `Level ${level}`}
              <button className="link-btn learn-btn" onClick={() => onLearn(level)}>
                📖 Learn{progress[`lesson:${level}`] ? " ✓" : ""}
              </button>
              {!unlocked && <span className="locked-tag">locked — pass a Level {level - 1} scenario</span>}
            </h2>
            <div className="scenario-grid">
              {list.map((s) => {
                const p = progress[s.id];
                return (
                  <button
                    key={s.id}
                    className={`scenario-card card ${!unlocked ? "soft-locked" : ""}`}
                    onClick={() => onPick(s)}
                  >
                    <span className="scenario-title">{s.title}</span>
                    <span className="scenario-airport">{s.briefing.airport}</span>
                    <span className="scenario-meta">
                      {s.steps.filter((st) => st.type === "studentCall").length} radio calls
                      {p && (
                        <span className={`best-score ${p.passed ? "pass" : ""}`}>
                          best {p.bestScore}%{p.passed ? " ✓" : ""}
                        </span>
                      )}
                    </span>
                    {!unlocked && <span className="practice-anyway">practice anyway →</span>}
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </main>
  );
}
