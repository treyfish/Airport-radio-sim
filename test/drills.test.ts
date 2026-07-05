import { describe, expect, it } from "vitest";
import { DRILLS, getDrill, makeRound, checkAnswer } from "../src/drills/drills";
import { canonicalize } from "../src/grader/normalizer";
import { extract } from "../src/grader/extractors";

describe("drill answer checking", () => {
  it("accepts typed, spoken, and separator-free forms", () => {
    expect(checkAnswer("29.92", "29.92")).toBe(true);
    expect(checkAnswer("2992", "29.92")).toBe(true);
    expect(checkAnswer("two niner niner two", "29.92")).toBe(true);
    expect(checkAnswer("119.2", "119.2")).toBe(true);
    expect(checkAnswer("one one niner point two", "119.2")).toBe(true);
  });

  it("accepts phonetic and letter forms for ATIS", () => {
    expect(checkAnswer("bravo", "bravo")).toBe(true);
    expect(checkAnswer("B", "bravo")).toBe(true);
    expect(checkAnswer("charlie", "bravo")).toBe(false);
  });

  it("tolerates labels and leading zeros", () => {
    expect(checkAnswer("runway 27", "27")).toBe(true);
    expect(checkAnswer("90", "090")).toBe(true);
    expect(checkAnswer("heading 270", "270")).toBe(true);
  });

  it("rejects wrong and empty answers", () => {
    expect(checkAnswer("28", "27")).toBe(false);
    expect(checkAnswer("", "27")).toBe(false);
  });
});

describe("drill generation", () => {
  it("registers all three drills", () => {
    expect(DRILLS.map((d) => d.id)).toEqual(["atis-copy", "clearance-copy", "whose-call"]);
    expect(getDrill("atis-copy")).toBeDefined();
  });

  it("copy rounds embed every expected value in the transmission", () => {
    for (const id of ["atis-copy", "clearance-copy"]) {
      for (let seed = 1; seed <= 10; seed++) {
        const round = makeRound(getDrill(id)!, "N123AB", seed);
        if (round.kind !== "copy") throw new Error("expected copy round");
        const canonTx = canonicalize(round.transmission);
        const canonTxStr = canonTx.join("").replace(/[^a-z0-9]/g, "");
        for (const field of round.fields) {
          // altitudes are spoken ("two thousand five hundred") — compare in feet
          if (field.key === "alt") {
            const match = extract("altitude", canonTx, canonicalize(field.expected));
            expect(match.correct, `${id} seed ${seed}: altitude ${field.expected}`).toBe(true);
            continue;
          }
          const canonExpected = canonicalize(field.expected).join("").replace(/[^a-z0-9]/g, "");
          expect(
            canonTxStr,
            `${id} seed ${seed}: "${field.expected}" missing from transmission`,
          ).toContain(canonExpected);
        }
      }
    }
  });

  it("discrimination rounds always contain both mine and not-mine calls", () => {
    for (let seed = 1; seed <= 20; seed++) {
      const round = makeRound(getDrill("whose-call")!, "N738PT", seed);
      if (round.kind !== "discriminate") throw new Error("expected discriminate round");
      expect(round.calls.length).toBe(8);
      expect(round.calls.some((c) => c.isMine)).toBe(true);
      expect(round.calls.some((c) => !c.isMine)).toBe(true);
      // no not-mine call may contain the student's actual callsign
      for (const call of round.calls) {
        if (!call.isMine) expect(call.text).not.toContain("N738PT");
      }
    }
  });

  it("is deterministic for a fixed seed", () => {
    const a = makeRound(getDrill("atis-copy")!, "N123AB", 42);
    const b = makeRound(getDrill("atis-copy")!, "N123AB", 42);
    expect(a).toEqual(b);
  });
});
