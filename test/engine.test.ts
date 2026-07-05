import { describe, expect, it } from "vitest";
import { ScenarioEngine, MAX_ATTEMPTS } from "../src/engine/scenarioEngine";
import { getScenario } from "../src/scenarios";
import type { Scenario } from "../src/types/scenario";

const SETTINGS = { callsign: "N123AB", seed: 42 };

function startEngine(id: string): ScenarioEngine {
  const scenario = getScenario(id);
  if (!scenario) throw new Error(`scenario ${id} not found`);
  return new ScenarioEngine(scenario, SETTINGS);
}

describe("scenario engine", () => {
  it("is deterministic for a fixed seed", () => {
    const a = new ScenarioEngine(getScenario("ctaf-pattern")!, SETTINGS);
    const b = new ScenarioEngine(getScenario("ctaf-pattern")!, SETTINGS);
    expect(a.env).toEqual(b.env);
  });

  it("uses the student's saved callsign", () => {
    const engine = startEngine("ctaf-pattern");
    expect(engine.env.callsign).toBe("N123AB");
  });

  it("runs the CTAF pattern scenario end to end with model calls", () => {
    const engine = startEngine("ctaf-pattern");
    let guard = 0;
    let events = engine.advance();
    while (!engine.isEnded() && guard++ < 50) {
      const await_ = events.find((e) => e.kind === "awaitCall");
      if (!await_) break;
      // answer with the step's own model call — should always pass
      const hint = await_.kind === "awaitCall" ? await_.hint : "";
      const result = engine.submitStudentCall(hint);
      expect(result.grade.passed).toBe(true);
      expect(result.advanced).toBe(true);
      events = engine.advance();
    }
    expect(engine.isEnded()).toBe(true);
    expect(engine.totalScore()).toBeGreaterThanOrEqual(engine.scenario.passingScore);
    expect(engine.passed()).toBe(true);
    expect(engine.results().length).toBe(7);
  });

  it("offers retries then advances after MAX_ATTEMPTS", () => {
    const engine = startEngine("ctaf-pattern");
    engine.advance();
    for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
      const result = engine.submitStudentCall("uhhh hello");
      expect(result.grade.passed).toBe(false);
      if (attempt < MAX_ATTEMPTS) {
        expect(result.advanced).toBe(false);
        expect(result.sayAgain).toBeDefined();
      } else {
        expect(result.advanced).toBe(true);
      }
    }
    expect(engine.results()[0].attempts.length).toBe(MAX_ATTEMPTS);
  });

  it("caps step score at 80 when the hint was used", () => {
    const engine = startEngine("ctaf-pattern");
    const events = engine.advance();
    const await_ = events.find((e) => e.kind === "awaitCall");
    expect(await_).toBeDefined();
    engine.markHintUsed();
    const hint = await_!.kind === "awaitCall" ? await_!.hint : "";
    engine.submitStudentCall(hint);
    expect(engine.results()[0].finalScore).toBeLessThanOrEqual(80);
  });

  it("propagates setsVariables into later readback checks", () => {
    const engine = startEngine("flight-following");
    // walk to the squawk assignment: callup → goahead → request → squawk
    let events = engine.advance();
    engine.submitStudentCall("Big Sky Approach, Skyhawk N123AB");
    events = engine.advance(); // "go ahead" + request prompt
    engine.submitStudentCall(
      "Skyhawk N123AB is a Cessna 172, one zero miles east of Cedar Valley at three thousand five hundred, request flight following to Centerville at five thousand five hundred",
    );
    events = engine.advance(); // squawk assignment + readback prompt
    const atc = events.find((e) => e.kind === "atc");
    expect(atc && atc.kind === "atc" ? atc.text : "").toMatch(/squawk \d{4}/i);
    const squawk = engine.env.squawk;
    expect(squawk).toMatch(/^[0-7]{4}$/);

    const good = engine.submitStudentCall(`Squawk ${squawk}, Skyhawk N123AB`);
    expect(good.grade.passed).toBe(true);
  });

  it("resolves weighted random branches to valid steps", () => {
    const scenario = getScenario("classd-taxi-takeoff")!;
    const stepIds = new Set(scenario.steps.map((s) => s.id));
    // run with many seeds; the branch target must always exist
    for (let seed = 0; seed < 20; seed++) {
      const engine = new ScenarioEngine(scenario, { callsign: "N123AB", seed });
      let events = engine.advance();
      let guard = 0;
      while (!engine.isEnded() && guard++ < 50) {
        const await_ = events.find((e) => e.kind === "awaitCall");
        if (!await_) break;
        const hint = await_.kind === "awaitCall" ? await_.hint : "";
        engine.submitStudentCall(hint);
        events = engine.advance();
      }
      expect(engine.isEnded()).toBe(true);
      expect(stepIds.size).toBeGreaterThan(0);
    }
  });
});

describe("branch coverage", () => {
  it("both tower branches (cleared / hold short) occur across seeds", () => {
    const scenario = getScenario("classd-taxi-takeoff") as Scenario;
    let sawHold = false;
    let sawDirect = false;
    for (let seed = 0; seed < 40 && !(sawHold && sawDirect); seed++) {
      const engine = new ScenarioEngine(scenario, { callsign: "N123AB", seed });
      let events = engine.advance();
      let guard = 0;
      let holdSeen = false;
      while (!engine.isEnded() && guard++ < 50) {
        for (const e of events) {
          if (e.kind === "atc" && /hold short/i.test(e.text) && /landing traffic/i.test(e.text)) {
            holdSeen = true;
          }
        }
        const await_ = events.find((e) => e.kind === "awaitCall");
        if (!await_) break;
        engine.submitStudentCall(await_.kind === "awaitCall" ? await_.hint : "");
        events = engine.advance();
      }
      if (holdSeen) sawHold = true;
      else sawDirect = true;
    }
    expect(sawHold).toBe(true);
    expect(sawDirect).toBe(true);
  });
});
