import { describe, expect, it } from "vitest";
import { RuleBasedGrader } from "../src/grader/grader";
import type { ExpectedCall } from "../src/types/scenario";

const grader = new RuleBasedGrader();

const takeoffReadback: ExpectedCall = {
  elements: [
    {
      id: "clearance",
      label: "takeoff clearance readback",
      extractor: "phrase",
      expected: "cleared for takeoff",
      required: true,
      weight: 3,
      feedbackMissing: "Read back the clearance itself.",
    },
    {
      id: "runway",
      label: "runway readback",
      extractor: "runway",
      expected: "{rwy}",
      required: true,
      weight: 2,
      feedbackMissing: "You forgot to read back the runway assignment.",
      feedbackWrong: "You read back runway {heard}, but you were cleared on runway {rwy}.",
    },
    {
      id: "callsign",
      label: "your callsign",
      extractor: "callsign",
      expected: "{callsign}",
      required: true,
      weight: 2,
      feedbackMissing: "End the readback with your callsign.",
    },
  ],
};

const env = { rwy: "18", callsign: "N123AB" };

describe("rule-based grader", () => {
  it("gives 100 for a perfect readback", () => {
    const r = grader.grade("Cleared for takeoff runway one eight, Skyhawk one two three alpha bravo", takeoffReadback, env);
    expect(r.score).toBe(100);
    expect(r.passed).toBe(true);
    expect(r.elements.every((e) => e.status === "ok" || e.status === "partial")).toBe(true);
  });

  it("also accepts the typed form", () => {
    const r = grader.grade("Cleared for takeoff runway 18, N123AB", takeoffReadback, env);
    expect(r.score).toBe(100);
  });

  it("calls out a missing runway readback specifically", () => {
    const r = grader.grade("Cleared for takeoff, N123AB", takeoffReadback, env);
    const runway = r.elements.find((e) => e.id === "runway");
    expect(runway?.status).toBe("missing");
    expect(runway?.feedback).toBe("You forgot to read back the runway assignment.");
    expect(r.score).toBeLessThan(100);
  });

  it("calls out a wrong runway with both values", () => {
    const r = grader.grade("Cleared for takeoff runway two seven, N123AB", takeoffReadback, env);
    const runway = r.elements.find((e) => e.id === "runway");
    expect(runway?.status).toBe("wrong");
    expect(runway?.feedback).toBe("You read back runway 27, but you were cleared on runway 18.");
  });

  it("fails a call that is mostly missing", () => {
    const r = grader.grade("roger", takeoffReadback, env);
    expect(r.passed).toBe(false);
  });

  it("emits pronunciation style notes in text mode only", () => {
    const text = grader.grade("Cleared for takeoff runway nine, N123AB", takeoffReadback, { ...env, rwy: "9" });
    expect(text.styleNotes.some((n) => n.includes("niner"))).toBe(true);

    const voice = grader.grade(
      "Cleared for takeoff runway nine, N123AB",
      takeoffReadback,
      { ...env, rwy: "9" },
      { voiceInput: true },
    );
    expect(voice.styleNotes.some((n) => n.includes("niner"))).toBe(false);
  });

  it("coaches against non-standard phrases in any mode", () => {
    const r = grader.grade(
      "Cleared for takeoff runway one eight with you, N123AB",
      takeoffReadback,
      env,
      { voiceInput: true },
    );
    expect(r.styleNotes.some((n) => n.includes("with you"))).toBe(true);
  });

  it("coaches on slow response delay without affecting the score", () => {
    const good = "Cleared for takeoff runway 18, N123AB";
    const slow = grader.grade(good, takeoffReadback, env, { timing: { delaySec: 12 } });
    expect(slow.styleNotes.some((n) => n.includes("12 seconds"))).toBe(true);
    expect(slow.score).toBe(100);

    const prompt = grader.grade(good, takeoffReadback, env, { timing: { delaySec: 2.5 } });
    expect(prompt.styleNotes.some((n) => n.includes("seconds to key up"))).toBe(false);
  });

  it("coaches on speaking pace at both extremes", () => {
    const good = "Cleared for takeoff runway 18, N123AB";
    const fast = grader.grade(good, takeoffReadback, env, { timing: { wpm: 220 } });
    expect(fast.styleNotes.some((n) => n.includes("rushing"))).toBe(true);

    const slow = grader.grade(good, takeoffReadback, env, { timing: { wpm: 60 } });
    expect(slow.styleNotes.some((n) => n.includes("touch slow"))).toBe(true);

    const normal = grader.grade(good, takeoffReadback, env, { timing: { wpm: 145 } });
    expect(normal.styleNotes.some((n) => n.includes("rushing") || n.includes("touch slow"))).toBe(false);
  });

  it("never penalizes optional elements", () => {
    const call: ExpectedCall = {
      elements: [
        ...takeoffReadback.elements,
        {
          id: "closing",
          label: "airport name closing",
          extractor: "phrase",
          expected: "cedar valley",
          required: false,
          weight: 1,
          feedbackMissing: "Close with the airport name.",
        },
      ],
    };
    const r = grader.grade("Cleared for takeoff runway 18, N123AB", call, env);
    expect(r.score).toBe(100);
  });
});
