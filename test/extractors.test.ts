import { describe, expect, it } from "vitest";
import { canonicalize } from "../src/grader/normalizer";
import { extract } from "../src/grader/extractors";
import type { ExtractorId } from "../src/types/scenario";

function run(id: ExtractorId, input: string, expected: string) {
  return extract(id, canonicalize(input), canonicalize(expected));
}

describe("runway extractor", () => {
  it("matches spoken and typed runways", () => {
    expect(run("runway", "departing runway one eight", "18").correct).toBe(true);
    expect(run("runway", "departing runway 18", "18").correct).toBe(true);
    expect(run("runway", "downwind 18", "18").correct).toBe(true);
  });

  it("reports the wrong runway it heard", () => {
    const m = run("runway", "cleared to land runway two seven", "18");
    expect(m.found).toBe(true);
    expect(m.correct).toBe(false);
    expect(m.heard).toBe("27");
  });

  it("handles side letters", () => {
    expect(run("runway", "runway two seven left", "27L").correct).toBe(true);
    expect(run("runway", "runway 27L", "27L").correct).toBe(true);
  });

  it("misses when no runway is present", () => {
    expect(run("runway", "taxiing to the ramp", "18").found).toBe(false);
  });
});

describe("callsign extractor", () => {
  it("matches full forms", () => {
    expect(run("callsign", "november one two three alpha bravo", "N123AB").correct).toBe(true);
    expect(run("callsign", "N123AB holding short", "N123AB").correct).toBe(true);
  });

  it("matches type + last-three abbreviation", () => {
    expect(run("callsign", "cessna three alpha bravo", "N123AB").correct).toBe(true);
    expect(run("callsign", "skyhawk 3AB", "N123AB").correct).toBe(true);
  });

  it("misses when callsign absent", () => {
    expect(run("callsign", "holding short runway one eight", "N123AB").found).toBe(false);
  });
});

describe("frequency extractor", () => {
  it("matches spoken frequencies", () => {
    expect(run("frequency", "one two four point seven", "124.7").correct).toBe(true);
    expect(run("frequency", "contact departure on 119.2", "119.2").correct).toBe(true);
  });

  it("tolerates a trailing zero difference", () => {
    expect(run("frequency", "one two zero point niner zero", "120.9").correct).toBe(true);
  });

  it("flags the wrong frequency", () => {
    const m = run("frequency", "one two six point four", "124.7");
    expect(m.found).toBe(true);
    expect(m.correct).toBe(false);
    expect(m.heard).toBe("126.4");
  });
});

describe("squawk extractor", () => {
  it("matches a correct code", () => {
    expect(run("squawk", "squawk four five two one", "4521").correct).toBe(true);
  });

  it("flags a wrong code with what was heard", () => {
    const m = run("squawk", "squawk four five one two", "4521");
    expect(m.found).toBe(true);
    expect(m.correct).toBe(false);
    expect(m.heard).toBe("4512");
  });

  it("does not steal digits from a frequency", () => {
    expect(run("squawk", "one one niner point two", "4521").found).toBe(false);
  });
});

describe("altitude extractor", () => {
  it("matches spoken thousands", () => {
    expect(run("altitude", "three thousand five hundred", "3500").correct).toBe(true);
    expect(run("altitude", "level three thousand five hundred", "three thousand five hundred").correct).toBe(true);
  });

  it("matches digit form", () => {
    expect(run("altitude", "climbing 2500", "two thousand five hundred").correct).toBe(true);
  });

  it("flags wrong altitude", () => {
    const m = run("altitude", "four thousand five hundred", "3500");
    expect(m.found).toBe(true);
    expect(m.correct).toBe(false);
    expect(m.heard).toBe("4500");
  });
});

describe("facility extractor", () => {
  it("matches clean facility names", () => {
    expect(run("facility", "centerville tower skyhawk", "centerville tower").correct).toBe(true);
  });

  it("is forgiving on mangled proper nouns but strict on the type word", () => {
    expect(run("facility", "centreville tower", "centerville tower").correct).toBe(true);
    expect(run("facility", "centerville ground", "centerville tower").found).toBe(false);
  });

  it("matches split airport names from speech recognition", () => {
    expect(run("facility", "cedar valley traffic skyhawk", "cedar valley traffic").correct).toBe(true);
  });
});

describe("atis extractor", () => {
  it("matches the information letter", () => {
    expect(run("atis", "with information bravo", "bravo").correct).toBe(true);
  });

  it("flags the wrong letter", () => {
    const m = run("atis", "with information charlie", "bravo");
    expect(m.found).toBe(true);
    expect(m.correct).toBe(false);
    expect(m.heard).toBe("c");
  });
});

describe("phrase and intent extractors", () => {
  it("phrase allows one miss on longer phrases", () => {
    expect(run("phrase", "cleared takeoff runway one eight", "cleared for takeoff runway 18").found).toBe(true);
  });

  it("intent matches out of order", () => {
    expect(run("intent", "flight following request to centerville", "request flight following to centerville").found).toBe(true);
  });

  it("misses genuinely absent content", () => {
    expect(run("phrase", "taxiing to the ramp", "cleared for takeoff").found).toBe(false);
  });
});
