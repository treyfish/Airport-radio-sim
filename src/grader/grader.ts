// Stage 4 of the grading pipeline: rubric scoring + feedback.
//
// `Grader` is the pluggable interface the scenario engine calls — the
// rule-based implementation below is the default; an AI-backed grader can
// implement the same interface later without touching engine/scenarios/UI.

import type { ExpectedCall, RequiredElement } from "../types/scenario";
import { tokenize } from "./tokenizer";
import { normalize } from "./normalizer";
import { extract } from "./extractors";
import { STYLE_PATTERNS } from "./phraseology";
import { renderTemplate, type Env } from "../engine/templates";

export type ElementStatus = "ok" | "partial" | "missing" | "wrong";

export interface ElementResult {
  id: string;
  label: string;
  status: ElementStatus;
  required: boolean;
  feedback?: string;
}

export interface GradeResult {
  score: number; // 0–100 weighted
  passed: boolean; // score >= STEP_PASS_SCORE
  elements: ElementResult[];
  styleNotes: string[];
}

export interface GradeOptions {
  /** true when the input came from speech recognition (suppresses pronunciation notes) */
  voiceInput?: boolean;
}

export interface Grader {
  grade(input: string, call: ExpectedCall, env: Env, opts?: GradeOptions): GradeResult;
}

export const STEP_PASS_SCORE = 70;

function gradeElement(
  element: RequiredElement,
  inputTokens: string[],
  env: Env,
): ElementResult {
  const expectedRaw = renderTemplate(element.expected, env);
  const expectedTokens = normalize(tokenize(expectedRaw));
  const match = extract(element.extractor, inputTokens, expectedTokens);

  let status: ElementStatus;
  let feedback: string | undefined;
  if (!match.found) {
    status = "missing";
    feedback = renderTemplate(element.feedbackMissing, env);
  } else if (!match.correct) {
    status = "wrong";
    const envWithHeard: Env = { ...env, heard: match.heard ?? "" };
    feedback = renderTemplate(
      element.feedbackWrong ?? element.feedbackMissing,
      envWithHeard,
    );
  } else if (!match.exact) {
    status = "partial";
  } else {
    status = "ok";
  }
  return { id: element.id, label: element.label, status, required: element.required, feedback };
}

function collectStyleNotes(raw: string, voiceInput: boolean): string[] {
  const notes: string[] = [];
  for (const p of STYLE_PATTERNS) {
    if (p.textModeOnly && voiceInput) continue;
    if (p.pattern.test(raw)) notes.push(p.note);
  }
  return notes;
}

export class RuleBasedGrader implements Grader {
  grade(input: string, call: ExpectedCall, env: Env, opts: GradeOptions = {}): GradeResult {
    const inputTokens = normalize(tokenize(input));
    const elements = call.elements.map((e) => gradeElement(e, inputTokens, env));

    let totalWeight = 0;
    let earned = 0;
    for (let i = 0; i < elements.length; i++) {
      const spec = call.elements[i];
      const res = elements[i];
      if (!spec.required) continue; // optional elements never penalize
      totalWeight += spec.weight;
      if (res.status === "ok") earned += spec.weight;
      else if (res.status === "partial") earned += spec.weight * 0.75;
      // "missing"/"wrong" earn nothing
    }
    const score = totalWeight === 0 ? 100 : Math.round((earned / totalWeight) * 100);

    return {
      score,
      passed: score >= STEP_PASS_SCORE,
      elements,
      styleNotes: collectStyleNotes(input, opts.voiceInput ?? false),
    };
  }
}

export const defaultGrader: Grader = new RuleBasedGrader();
