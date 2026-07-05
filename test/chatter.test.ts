import { describe, expect, it } from "vitest";
import { similarCallsign, generateChatterCall, chatterIntervalMs } from "../src/engine/chatter";
import { mulberry32 } from "../src/engine/variables";
import { getScenario } from "../src/scenarios";

describe("similarCallsign", () => {
  it("never returns the original and keeps the same length", () => {
    const rng = mulberry32(7);
    for (let i = 0; i < 200; i++) {
      const similar = similarCallsign("N738PT", rng);
      expect(similar).not.toBe("N738PT");
      expect(similar.length).toBe(6);
      expect(similar.startsWith("N")).toBe(true);
    }
  });

  it("differs by exactly one character", () => {
    const rng = mulberry32(11);
    for (let i = 0; i < 100; i++) {
      const original = "N738PT";
      const similar = similarCallsign(original, rng);
      const diffs = [...original].filter((c, j) => c !== similar[j]).length;
      expect(diffs).toBe(1);
    }
  });
});

describe("chatter generation", () => {
  it("produces valid calls for every scenario kind", () => {
    for (const id of ["ctaf-pattern", "classd-taxi-takeoff", "flight-following", "classc-departure"]) {
      const scenario = getScenario(id)!;
      const rng = mulberry32(3);
      const env = { callsign: "N738PT", rwy: "18" };
      for (let i = 0; i < 50; i++) {
        const call = generateChatterCall(scenario, env, rng);
        expect(call.text.length).toBeGreaterThan(10);
        expect(call.speaker.length).toBeGreaterThan(0);
        if (call.isDistractor) {
          expect(call.distractorCallsign).toBeDefined();
          expect(call.distractorCallsign).not.toBe("N738PT");
          if (call.distractorCallsign) {
            expect(call.text).toContain(call.distractorCallsign);
          }
          expect(call.distractorKey).toBeDefined();
        } else {
          // ambient chatter must never address the student
          expect(call.text).not.toContain("N738PT");
        }
      }
    }
  });

  it("mixes distractors and ambient calls", () => {
    const scenario = getScenario("classd-taxi-takeoff")!;
    const rng = mulberry32(5);
    const calls = Array.from({ length: 60 }, () =>
      generateChatterCall(scenario, { callsign: "N738PT", rwy: "13" }, rng),
    );
    expect(calls.some((c) => c.isDistractor)).toBe(true);
    expect(calls.some((c) => !c.isDistractor)).toBe(true);
  });

  it("scales cadence with level", () => {
    const rng = mulberry32(9);
    const l1 = Array.from({ length: 50 }, () => chatterIntervalMs(1, rng)).reduce((a, b) => a + b) / 50;
    const l4 = Array.from({ length: 50 }, () => chatterIntervalMs(4, rng)).reduce((a, b) => a + b) / 50;
    expect(l4).toBeLessThan(l1);
  });
});
