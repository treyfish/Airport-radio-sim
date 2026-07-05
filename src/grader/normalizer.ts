// Stage 2 of the grading pipeline: tokens → canonical form.
//
// Canonical form is a stream of single characters and plain words:
//   - every number appears as single digits ("128.3" → "1 2 8 . 3")
//   - aviation digit words are digits ("niner" → "9", "tree" → "3")
//   - phonetic alphabet words are letters ("alpha" → "a")
//   - alphanumeric blends are exploded ("n123ab" → "n 1 2 3 a b")
// so "November one two three alpha bravo", "N123AB", and recognizer output
// like "november 123 alpha bravo" all normalize identically.

import { tokenize } from "./tokenizer";
import {
  PHONETIC_ALPHABET,
  DIGIT_WORDS,
  TENS_WORDS,
  DECIMAL_WORDS,
  MAGNITUDE_WORDS,
  AIRCRAFT_SYNONYMS,
} from "./phraseology";

function explode(token: string): string[] {
  // "128.3" → ["1","2","8",".","3"]; "n123ab" → ["n","1","2","3","a","b"]
  return token.split("");
}

function isNumericBlend(token: string): boolean {
  return /[0-9]/.test(token) && /^[a-z0-9.]+$/.test(token);
}

export function normalize(tokens: string[]): string[] {
  const out: string[] = [];
  for (const token of tokens) {
    if (DIGIT_WORDS[token]) {
      out.push(DIGIT_WORDS[token]);
    } else if (TENS_WORDS[token]) {
      out.push(...explode(TENS_WORDS[token]));
    } else if (DECIMAL_WORDS.has(token)) {
      out.push(".");
    } else if (MAGNITUDE_WORDS.has(token)) {
      out.push(token);
    } else if (PHONETIC_ALPHABET[token]) {
      out.push(PHONETIC_ALPHABET[token]);
    } else if (AIRCRAFT_SYNONYMS[token]) {
      out.push(AIRCRAFT_SYNONYMS[token]);
    } else if (isNumericBlend(token)) {
      out.push(...explode(token));
    } else {
      out.push(token);
    }
  }
  return out;
}

export function canonicalize(raw: string): string[] {
  return normalize(tokenize(raw));
}
