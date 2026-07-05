import { useMemo, useRef, useState } from "react";
import type { Scenario } from "./types/scenario";
import { ScenarioEngine, type StepResult } from "./engine/scenarioEngine";
import { loadState, saveSettings, recordResult, type Settings } from "./state/persistence";
import ScenarioPicker from "./screens/ScenarioPicker";
import Briefing from "./screens/Briefing";
import Radio from "./screens/Radio";
import Debrief from "./screens/Debrief";
import Lesson from "./screens/Lesson";
import Glossary from "./screens/Glossary";
import { lessonForLevel, type LessonDeck } from "./content/lessons";

type Screen = "picker" | "briefing" | "radio" | "debrief" | "lesson" | "glossary";

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
  const [lessonDeck, setLessonDeck] = useState<LessonDeck | null>(null);
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
    setLessonDeck(null);
    setScreen("picker");
  };

  const openLesson = (level: number) => {
    const deck = lessonForLevel(level);
    if (!deck) return;
    setLessonDeck(deck);
    setScreen("lesson");
  };

  const finishLesson = () => {
    if (lessonDeck) {
      setPersisted(recordResult(`lesson:${lessonDeck.level}`, 100, true));
    }
    backToPicker();
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
            onLearn={openLesson}
          />
        );
      case "lesson":
        return lessonDeck ? (
          <Lesson deck={lessonDeck} onDone={finishLesson} onBack={backToPicker} />
        ) : null;
      case "glossary":
        return <Glossary onBack={backToPicker} />;
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
        <button className="link-btn header-link" onClick={() => setScreen("glossary")}>
          Glossary
        </button>
      </header>
      {body}
    </div>
  );
}
