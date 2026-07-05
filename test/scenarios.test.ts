// Every scenario JSON must pass schema validation — a bad scenario file
// fails here, not at runtime. Also plays every scenario end-to-end using
// each step's own model call (hint), across several seeds, to prove the
// model call always passes its own rubric.

import { describe, expect, it } from "vitest";
import { scenarios } from "../src/scenarios";
import { validateScenario } from "../src/engine/validateScenario";
import { ScenarioEngine } from "../src/engine/scenarioEngine";

describe("scenario files", () => {
  it("has at least one scenario per level", () => {
    const levels = new Set(scenarios.map((s) => s.level));
    expect([...levels].sort()).toEqual([1, 2, 3, 4]);
  });

  for (const scenario of scenarios) {
    describe(scenario.id, () => {
      it("passes schema validation", () => {
        expect(validateScenario(scenario)).toEqual([]);
      });

      it("has unique id", () => {
        expect(scenarios.filter((s) => s.id === scenario.id).length).toBe(1);
      });

      for (const seed of [1, 7, 13]) {
        it(`model calls pass their own rubric (seed ${seed})`, () => {
          const engine = new ScenarioEngine(scenario, { callsign: "N456CD", seed });
          let events = engine.advance();
          let guard = 0;
          while (!engine.isEnded() && guard++ < 60) {
            const await_ = events.find((e) => e.kind === "awaitCall");
            if (!await_ || await_.kind !== "awaitCall") break;
            const result = engine.submitStudentCall(await_.hint);
            expect(
              result.grade.passed,
              `step ${await_.step.id}: model call "${await_.hint}" scored ${result.grade.score}% — ` +
                result.grade.elements
                  .filter((e) => e.status !== "ok")
                  .map((e) => `${e.id}=${e.status}`)
                  .join(", "),
            ).toBe(true);
            events = engine.advance();
          }
          expect(engine.isEnded()).toBe(true);
          expect(engine.passed()).toBe(true);
        });
      }
    });
  }
});
