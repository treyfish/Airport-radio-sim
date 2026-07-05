// Stage 3 of the grading pipeline: find expected elements in the canonical
// token stream. Each extractor answers: is this element present, and if a
// value-bearing element (runway, frequency…), what value did the student say?

import type { ExtractorId } from "../types/scenario";

export interface ElementMatch {
  found: boolean; // the element (or its slot pattern) appeared at all
  correct: boolean; // and carried the expected value
  exact: boolean; // matched with no fuzz
  heard?: string; // human-readable value the student actually said
}

const NO_MATCH: ElementMatch = { found: false, correct: false, exact: false };

function isDigit(t: string): boolean {
  return t.length === 1 && t >= "0" && t <= "9";
}

/** Levenshtein distance capped for short words — used on proper nouns only. */
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[] = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(dp[j] + 1, dp[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
      prev = tmp;
    }
  }
  return dp[n];
}

interface SubseqResult {
  matched: number;
  total: number;
  firstIndex: number;
}

/**
 * In-order subsequence match of `expected` within `input`, with per-token
 * fuzz on words of 4+ chars (edit distance ≤ fuzz). Returns how many expected
 * tokens were found in order.
 */
function subsequenceMatch(input: string[], expected: string[], fuzz: number): SubseqResult {
  let matched = 0;
  let firstIndex = -1;
  let i = 0;
  for (const exp of expected) {
    const resumeAt = i; // a missed token must not exhaust the scan for later ones
    let found = false;
    for (; i < input.length; i++) {
      const tok = input[i];
      const ok =
        tok === exp ||
        (fuzz > 0 && exp.length >= 4 && tok.length >= 3 && editDistance(tok, exp) <= fuzz);
      if (ok) {
        if (firstIndex < 0) firstIndex = i;
        matched++;
        i++;
        found = true;
        break;
      }
    }
    if (!found) i = resumeAt;
  }
  return { matched, total: expected.length, firstIndex };
}

/** Fuzzy phrase: all expected tokens in order; 1 miss tolerated for phrases ≥4 tokens. */
function matchPhrase(input: string[], expected: string[], fuzzWords = 1): ElementMatch {
  if (expected.length === 0) return { found: true, correct: true, exact: true };
  const r = subsequenceMatch(input, expected, fuzzWords);
  if (r.matched === r.total) {
    return { found: true, correct: true, exact: true };
  }
  const allowedMisses = expected.length >= 4 ? 1 : 0;
  if (r.total - r.matched <= allowedMisses) {
    return { found: true, correct: true, exact: false };
  }
  return NO_MATCH;
}

/** Looser intent match: majority of tokens present in any order. */
function matchIntent(input: string[], expected: string[]): ElementMatch {
  if (expected.length === 0) return { found: true, correct: true, exact: true };
  const pool = new Map<string, number>();
  for (const t of input) pool.set(t, (pool.get(t) ?? 0) + 1);
  let matched = 0;
  for (const exp of expected) {
    const direct = pool.get(exp) ?? 0;
    if (direct > 0) {
      pool.set(exp, direct - 1);
      matched++;
      continue;
    }
    if (exp.length >= 4) {
      for (const [tok, count] of pool) {
        if (count > 0 && tok.length >= 3 && editDistance(tok, exp) <= 1) {
          pool.set(tok, count - 1);
          matched++;
          break;
        }
      }
    }
  }
  const misses = expected.length - matched;
  const allowed = expected.length >= 3 ? 1 : 0;
  if (misses === 0) return { found: true, correct: true, exact: true };
  if (misses <= allowed) return { found: true, correct: true, exact: false };
  return NO_MATCH;
}

/**
 * Runway: find `runway? d d? (l|r|c)?` groups and compare digits+side.
 * Reports the heard value so feedback can say "you said 27, ATC said 18".
 */
function matchRunway(input: string[], expected: string[]): ElementMatch {
  const expDigits = expected.filter((t) => isDigit(t) || t === "l" || t === "r" || t === "c");
  const expStr = expDigits.join("");
  const hasKeyword = input.includes("runway");
  const candidates: string[] = [];

  for (let i = 0; i < input.length; i++) {
    if (!isDigit(input[i])) continue;
    // runway numbers are 1–2 digits + optional side letter
    const start = i;
    let j = i;
    let group = input[j];
    if (j + 1 < input.length && isDigit(input[j + 1])) {
      group += input[j + 1];
      j++;
    }
    if (j + 1 < input.length && ["l", "r", "c", "left", "right", "center"].includes(input[j + 1])) {
      group += input[j + 1][0];
      j++;
    }
    const nearRunway =
      (start >= 1 && input[start - 1] === "runway") || (start >= 2 && input[start - 2] === "runway");
    i = j;

    if (hasKeyword) {
      // "runway" was said — only digits next to it are runway candidates
      if (!nearRunway) continue;
      candidates.push(group);
    } else {
      // bare position call ("downwind 18"): require 2 digits and skip
      // groups that are clearly callsign fragments (single letters adjacent)
      const before = input[start - 1];
      const after = input[j + 1];
      const inCallsignRun =
        (before !== undefined && before.length === 1 && !isDigit(before)) ||
        (after !== undefined && after.length === 1 && !isDigit(after) && !["l", "r", "c"].includes(after));
      if (group.replace(/[lrc]$/, "").length < 2 || inCallsignRun) continue;
      candidates.push(group);
    }
  }

  for (const cand of candidates) {
    // allow "36" to match expected "36" and "9" to match "09"
    if (cand === expStr || cand === expStr.replace(/^0/, "") || `0${cand}` === expStr) {
      return { found: true, correct: true, exact: true, heard: cand };
    }
  }
  if (candidates.length > 0) {
    return { found: true, correct: false, exact: false, heard: candidates[0] };
  }
  return NO_MATCH;
}

/**
 * Callsign: accepts the full form ("n 1 2 3 a b" or "cessna 1 2 3 a b") and,
 * when `expected` is the abbreviated template, type/prefix + last three
 * ("cessna 3 a b", "n 3 a b").
 */
function matchCallsign(input: string[], expected: string[]): ElementMatch {
  const full = matchPhrase(input, expected, 1);
  if (full.exact) return full;

  // "Skyhawk one two three alpha bravo" — type word replaces the leading "N";
  // that's standard phraseology, so the full tail earns full credit.
  if (expected[0] === "n") {
    const tailFull = matchPhrase(input, expected.slice(1), 0);
    if (tailFull.exact) return tailFull;
  }
  if (full.found) return full;

  // Abbreviation: leading identifier (n / aircraft type word) + last 3 chars.
  const tail = expected.filter((t) => t.length === 1);
  if (tail.length >= 3) {
    const lastThree = tail.slice(-3);
    const typeWords = expected.filter((t) => t.length > 1); // e.g. "cessna"
    const heads = [...typeWords, "n"];
    for (const head of heads) {
      const abbrev = [head, ...lastThree];
      const r = matchPhrase(input, abbrev, 1);
      if (r.found) return { ...r, exact: false };
    }
    // bare last-three at the very end of the call (common on later calls)
    const endTokens = input.slice(-3);
    if (endTokens.join(" ") === lastThree.join(" ")) {
      return { found: true, correct: true, exact: false };
    }
  }
  return NO_MATCH;
}

/** Frequency: d d d . d d? — tolerant of a dropped trailing digit. */
function matchFrequency(input: string[], expected: string[]): ElementMatch {
  const expStr = expected.join("");
  const heardFreqs: string[] = [];
  for (let i = 0; i + 3 < input.length; i++) {
    if (
      isDigit(input[i]) &&
      isDigit(input[i + 1]) &&
      isDigit(input[i + 2]) &&
      input[i + 3] === "."
    ) {
      let freq = input[i] + input[i + 1] + input[i + 2] + ".";
      let j = i + 4;
      while (j < input.length && isDigit(input[j])) {
        freq += input[j];
        j++;
      }
      heardFreqs.push(freq);
    }
  }
  for (const f of heardFreqs) {
    if (
      f === expStr ||
      f === expStr.replace(/0$/, "") ||
      `${f}0` === expStr ||
      f.replace(/0$/, "") === expStr
    ) {
      return { found: true, correct: true, exact: true, heard: f };
    }
  }
  if (heardFreqs.length > 0) {
    return { found: true, correct: false, exact: false, heard: heardFreqs[0] };
  }
  return NO_MATCH;
}

/** Squawk: exactly 4 digits, each 0–7. */
function matchSquawk(input: string[], expected: string[]): ElementMatch {
  const expStr = expected.filter(isDigit).join("");
  const heard: string[] = [];
  for (let i = 0; i + 3 < input.length; i++) {
    const four = input.slice(i, i + 4);
    if (four.every((t) => isDigit(t) && t <= "7")) {
      // must not be part of a longer digit run (e.g. inside a frequency)
      const before = input[i - 1];
      const after = input[i + 4];
      if ((before && (isDigit(before) || before === ".")) || (after && (isDigit(after) || after === "."))) {
        continue;
      }
      heard.push(four.join(""));
      i += 3;
    }
  }
  for (const h of heard) {
    if (h === expStr) return { found: true, correct: true, exact: true, heard: h };
  }
  if (heard.length > 0) return { found: true, correct: false, exact: false, heard: heard[0] };
  return NO_MATCH;
}

/**
 * Altitude: understands "3 thousand 5 hundred", "4 5 0 0", and mixes.
 * Normalizes both sides to feet before comparing.
 */
export function parseAltitudeFeet(tokens: string[]): { feet: number; end: number } | null {
  for (let i = 0; i < tokens.length; i++) {
    if (!isDigit(tokens[i])) continue;
    // collect a digit run
    let j = i;
    let digits = "";
    while (j < tokens.length && isDigit(tokens[j])) {
      digits += tokens[j];
      j++;
    }
    if (j < tokens.length && tokens[j] === "thousand") {
      let feet = parseInt(digits, 10) * 1000;
      let k = j + 1;
      if (k < tokens.length && isDigit(tokens[k])) {
        let d2 = "";
        while (k < tokens.length && isDigit(tokens[k])) {
          d2 += tokens[k];
          k++;
        }
        if (k < tokens.length && tokens[k] === "hundred") {
          feet += parseInt(d2, 10) * 100;
          k++;
        } else {
          k = j + 1; // digits after "thousand" weren't hundreds — leave them
        }
      }
      return { feet, end: k };
    }
    if (j < tokens.length && tokens[j] === "hundred") {
      return { feet: parseInt(digits, 10) * 100, end: j + 1 };
    }
    // bare digit run: 3-5 digits reads as feet ("4500", "10500")
    if (digits.length >= 3 && digits.length <= 5) {
      return { feet: parseInt(digits, 10), end: j };
    }
  }
  return null;
}

function matchAltitude(input: string[], expected: string[]): ElementMatch {
  const exp = parseAltitudeFeet(expected);
  if (!exp) return NO_MATCH;
  // scan every position for altitude expressions
  for (let i = 0; i < input.length; i++) {
    const got = parseAltitudeFeet(input.slice(i));
    if (got) {
      if (got.feet === exp.feet) {
        return { found: true, correct: true, exact: true, heard: `${got.feet}` };
      }
      i += Math.max(got.end - 1, 0);
    }
  }
  // second pass: report first wrong altitude heard
  const first = parseAltitudeFeet(input);
  if (first) return { found: true, correct: false, exact: false, heard: `${first.feet}` };
  return NO_MATCH;
}

/** Facility: extra-fuzzy on proper nouns; exact on the facility type word. */
function matchFacility(input: string[], expected: string[]): ElementMatch {
  if (expected.length === 0) return { found: true, correct: true, exact: true };
  const typeWords = new Set([
    "traffic", "tower", "ground", "approach", "departure", "center", "clearance", "delivery", "radio", "unicom",
  ]);
  let nameMatched = 0;
  let nameTotal = 0;
  let typeMatched = 0;
  let typeTotal = 0;
  let searchFrom = 0;
  for (const exp of expected) {
    const isType = typeWords.has(exp);
    if (isType) typeTotal++;
    else nameTotal++;
    for (let i = searchFrom; i < input.length; i++) {
      const tok = input[i];
      const ok = isType
        ? tok === exp
        : tok === exp || (exp.length >= 4 && tok.length >= 3 && editDistance(tok, exp) <= 2);
      if (ok) {
        if (isType) typeMatched++;
        else nameMatched++;
        searchFrom = i + 1;
        break;
      }
    }
  }
  const typeOk = typeTotal === 0 || typeMatched === typeTotal;
  const nameOk = nameTotal === 0 || nameMatched >= Math.ceil(nameTotal / 2);
  if (typeOk && nameOk) {
    const exact = typeMatched === typeTotal && nameMatched === nameTotal;
    return { found: true, correct: true, exact };
  }
  return NO_MATCH;
}

/** ATIS code: single letter, ideally near "information". */
function matchAtis(input: string[], expected: string[]): ElementMatch {
  const expLetter = expected.find((t) => t.length === 1 && t >= "a" && t <= "z");
  if (!expLetter) return NO_MATCH;
  for (let i = 0; i < input.length; i++) {
    if (input[i] === "information" && i + 1 < input.length) {
      const next = input[i + 1];
      if (next.length === 1 && next >= "a" && next <= "z") {
        return next === expLetter
          ? { found: true, correct: true, exact: true, heard: next }
          : { found: true, correct: false, exact: false, heard: next };
      }
    }
  }
  // fallback: bare letter anywhere that isn't part of a callsign-ish run
  for (let i = 0; i < input.length; i++) {
    if (input[i] === expLetter) {
      const prev = input[i - 1];
      const next = input[i + 1];
      const inRun =
        (prev && (isDigit(prev) || prev.length === 1)) ||
        (next && (isDigit(next) || next.length === 1));
      if (!inRun) return { found: true, correct: true, exact: true, heard: expLetter };
    }
  }
  return NO_MATCH;
}

export function extract(
  id: ExtractorId,
  input: string[],
  expected: string[],
): ElementMatch {
  switch (id) {
    case "phrase":
    case "position":
      return matchPhrase(input, expected);
    case "intent":
      return matchIntent(input, expected);
    case "runway":
      return matchRunway(input, expected);
    case "callsign":
      return matchCallsign(input, expected);
    case "frequency":
      return matchFrequency(input, expected);
    case "squawk":
      return matchSquawk(input, expected);
    case "altitude":
      return matchAltitude(input, expected);
    case "facility":
      return matchFacility(input, expected);
    case "atis":
      return matchAtis(input, expected);
  }
}
