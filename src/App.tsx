import { useMemo, useRef, useState } from "react";
import type { Scenario } from "./types/scenario";
import { ScenarioEngine, type StepResult } from "./engine/scenarioEngine";
import { loadState, saveSettings, recordResult, type Settings } from "./state/persistence";
import ScenarioPicker from "./screens/ScenarioPicker";
import Briefing from "./screens/Briefing";
import Radio from "./screens/Radio";
import Debrief from "./screens/Debrief";

type Screen = "picker" | "briefing" | "radio" | "debrief";

export interface DebriefData {
  scenario: Scenario;
  results: StepResult[];
  totalScore: number;
  passed: boolean;
}

export default function App() {
  const [persisted, setPersisted] = useState(loadState);
  const [screen, setScreen] = useState<Screen>("picker");
  const [scenario, setScenario] = useState<Scenario | null>(null);
  const [debrief, setDebrief] = useState<DebriefData | null>(null);
  const engineRef = useRef<ScenarioEngine | null>(null);

  const settings = persisted.settings;

  const updateSettings = (next: Settings) => {
    setPersisted(saveSettings(next));
  };

  const pickScenario = (s: Scenario) => {
    setScenario(s);
    setScreen("briefing");
  };

  const startScenario = () => {
    if (!scenario) return;
    engineRef.current = new ScenarioEngine(scenario, { callsign: settings.callsign });
    setScreen("radio");
  };

  const finishScenario = () => {
    const engine = engineRef.current;
    if (!engine || !scenario) return;
    const totalScore = engine.totalScore();
    const passed = engine.passed();
    setPersisted(recordResult(scenario.id, totalScore, passed));
    setDebrief({ scenario, results: engine.results(), totalScore, passed });
    setScreen("debrief");
  };

  const backToPicker = () => {
    engineRef.current = null;
    setScenario(null);
    setDebrief(null);
    setScreen("picker");
  };

  const retryScenario = () => {
    setDebrief(null);
    setScreen("briefing");
  };

  const body = useMemo(() => {
    switch (screen) {
      case "picker":
        return (
          <ScenarioPicker
            persisted={persisted}
            onPick={pickScenario}
            onSettingsChange={updateSettings}
          />
        );
      case "briefing":
        return scenario ? (
          <Briefing scenario={scenario} settings={settings} onStart={startScenario} onBack={backToPicker} />
        ) : null;
      case "radio":
        return engineRef.current ? (
          <Radio engine={engineRef.current} settings={settings} onFinish={finishScenario} onQuit={backToPicker} />
        ) : null;
      case "debrief":
        return debrief ? (
          <Debrief data={debrief} onRetry={retryScenario} onDone={backToPicker} />
        ) : null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [screen, scenario, debrief, persisted]);

  return (
    <div className="app">
      <header className="app-header">
        <h1 onClick={backToPicker}>✈️ Airport Radio Sim</h1>
        <span className="tagline">Sound like a pro on frequency</span>
      </header>
      {body}
    </div>
  );
}
