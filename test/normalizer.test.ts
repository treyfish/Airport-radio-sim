import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/grader/normalizer";

describe("normalizer canonical form", () => {
  it("converges spoken and typed frequencies", () => {
    expect(canonicalize("one two eight point three")).toEqual(canonicalize("128.3"));
    expect(canonicalize("one two eight decimal three")).toEqual(canonicalize("128.3"));
  });

  it("handles aviation digit pronunciations", () => {
    expect(canonicalize("niner")).toEqual(["9"]);
    expect(canonicalize("tree")).toEqual(["3"]);
    expect(canonicalize("fife")).toEqual(["5"]);
    expect(canonicalize("zero")).toEqual(["0"]);
  });

  it("converges callsign forms", () => {
    const spoken = canonicalize("November one two three alpha bravo");
    expect(spoken).toEqual(["n", "1", "2", "3", "a", "b"]);
    expect(canonicalize("N123AB")).toEqual(spoken);
    expect(canonicalize("november 123 alpha bravo")).toEqual(spoken);
  });

  it("handles ICAO spelling variants", () => {
    expect(canonicalize("alfa")).toEqual(["a"]);
    expect(canonicalize("juliett")).toEqual(["j"]);
    expect(canonicalize("juliet")).toEqual(["j"]);
    expect(canonicalize("x-ray")).toEqual(["x"]);
  });

  it("keeps magnitude words for altitude parsing", () => {
    expect(canonicalize("tree thousand fife hundred")).toEqual(["3", "thousand", "5", "hundred"]);
    expect(canonicalize("three thousand five hundred")).toEqual(["3", "thousand", "5", "hundred"]);
  });

  it("explodes multi-digit numbers", () => {
    expect(canonicalize("runway 27")).toEqual(["runway", "2", "7"]);
    expect(canonicalize("squawk 4521")).toEqual(["squawk", "4", "5", "2", "1"]);
    expect(canonicalize("twenty")).toEqual(["2", "0"]);
  });

  it("folds aircraft-type synonyms including recognizer manglings", () => {
    expect(canonicalize("Skyhawk 3AB")).toEqual(canonicalize("Cessna 3AB"));
    expect(canonicalize("sessna 3AB")).toEqual(canonicalize("Cessna 3AB"));
  });

  it("strips punctuation but keeps decimals inside numbers", () => {
    expect(canonicalize("Cedar Valley traffic, Skyhawk 123AB!")).toEqual([
      "cedar", "valley", "traffic", "cessna", "1", "2", "3", "a", "b",
    ]);
  });
});
