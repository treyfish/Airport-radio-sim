import { useMemo } from "react";
import type { Scenario } from "../types/scenario";
import type { Settings } from "../state/persistence";
import { renderTemplate } from "../engine/templates";
import { unlockAudio } from "../audio/radioFx";

interface Props {
  scenario: Scenario;
  settings: Settings;
  onStart(): void;
  onBack(): void;
}

export default function Briefing({ scenario, settings, onStart, onBack }: Props) {
  const callsign = settings.callsign || "(random tail number)";

  // Variables aren't resolved until the engine starts, so the briefing shows
  // structure ("runway {rwy}") generically by hiding unresolved templates.
  const description = useMemo(
    () => renderTemplate(scenario.briefing.description, {}).replace(/\{[a-z_]+\}/g, "—"),
    [scenario],
  );

  return (
    <main className="briefing card">
      <button className="link-btn" onClick={onBack}>← back to scenarios</button>
      <h2>{scenario.title}</h2>
      <p className="airport">{scenario.briefing.airport}</p>
      <p className="description">{description}</p>

      <div className="briefing-grid">
        <div>
          <h3>Your aircraft</h3>
          <p>{scenario.briefing.aircraft}</p>
          <p className="callsign">{callsign}</p>
        </div>
        <div>
          <h3>Frequencies</h3>
          <table className="freq-table">
            <tbody>
              {scenario.briefing.frequencies.map((f) => (
                <tr key={f.name}>
                  <td>{f.name}</td>
                  <td className="mono">{f.mhz}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <p className="formula-tip">
        📻 The formula: <strong>who</strong> you're calling, <strong>who</strong> you are,{" "}
        <strong>where</strong> you are, <strong>what</strong> you want.
      </p>

      <button
        className="primary-btn"
        onClick={() => {
          unlockAudio();
          onStart();
        }}
      >
        Start — tune {scenario.briefing.frequencies[0].mhz}
      </button>
    </main>
  );
}
