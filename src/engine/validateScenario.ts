// Runtime schema validation for scenario JSON files. Run by the scenario
// test suite (and at dev-time load) so a bad scenario fails CI, not runtime.

import type { Scenario, Step, NextRef } from "../types/scenario";
import { templateVariables } from "./templates";

const EXTRACTORS = new Set([
  "facility", "callsign", "runway", "position", "altitude",
  "frequency", "squawk", "atis", "phrase", "intent",
]);

export function validateScenario(data: unknown): string[] {
  const errors: string[] = [];
  const err = (msg: string) => errors.push(msg);
  const s = data as Scenario;

  if (!s || typeof s !== "object") return ["scenario is not an object"];
  if (!s.id || typeof s.id !== "string") err("missing string id");
  if (![1, 2, 3, 4].includes(s.level)) err("level must be 1–4");
  if (!s.title) err("missing title");
  if (!s.briefing || typeof s.briefing !== "object") err("missing briefing");
  else {
    if (!s.briefing.airport) err("briefing.airport missing");
    if (!s.briefing.description) err("briefing.description missing");
    if (!s.briefing.aircraft) err("briefing.aircraft missing");
    if (!Array.isArray(s.briefing.frequencies) || s.briefing.frequencies.length === 0)
      err("briefing.frequencies must be a non-empty array");
  }
  if (typeof s.passingScore !== "number" || s.passingScore < 0 || s.passingScore > 100)
    err("passingScore must be 0–100");
  if (!Array.isArray(s.variables)) err("variables must be an array");
  if (!Array.isArray(s.steps) || s.steps.length === 0) {
    err("steps must be a non-empty array");
    return errors;
  }

  const ids = new Set<string>();
  for (const step of s.steps) {
    if (!step.id) err("step missing id");
    else if (ids.has(step.id)) err(`duplicate step id: ${step.id}`);
    else ids.add(step.id);
  }

  // env vars available: declared variables + anything set by setsVariables
  const envVars = new Set(s.variables.map((v) => v.name));
  for (const step of s.steps) {
    if (step.type === "atcSay" && step.setsVariables) {
      for (const name of Object.keys(step.setsVariables)) envVars.add(name);
    }
  }
  envVars.add("heard"); // injected by the grader for feedbackWrong

  const checkTemplate = (template: string, where: string) => {
    for (const name of templateVariables(template)) {
      if (name.startsWith("gen:")) continue;
      if (!envVars.has(name)) err(`${where}: unknown variable {${name}}`);
    }
  };

  const checkNext = (next: NextRef, where: string) => {
    if (next === null) return;
    if (typeof next === "string") {
      if (!ids.has(next)) err(`${where}: next points to unknown step "${next}"`);
      return;
    }
    if (!Array.isArray(next) || next.length === 0) {
      err(`${where}: next must be a step id, branch array, or null`);
      return;
    }
    for (const b of next) {
      if (!["random", "always"].includes(b.when)) err(`${where}: bad branch.when`);
      if (!ids.has(b.goTo)) err(`${where}: branch points to unknown step "${b.goTo}"`);
      if (b.when === "random" && b.weight !== undefined && b.weight <= 0)
        err(`${where}: branch weight must be > 0`);
    }
  };

  let sawEnd = false;
  for (const step of s.steps as Step[]) {
    const where = `step ${step.id}`;
    if (!["studentCall", "atcSay", "event"].includes(step.type)) {
      err(`${where}: unknown type "${(step as { type?: string }).type}"`);
      continue;
    }
    checkNext(step.next, where);
    if (step.next === null) sawEnd = true;

    if (step.type === "studentCall") {
      checkTemplate(step.prompt, `${where}.prompt`);
      checkTemplate(step.hint, `${where}.hint`);
      if (!step.call?.elements?.length) err(`${where}: call.elements must be non-empty`);
      for (const el of step.call?.elements ?? []) {
        if (!EXTRACTORS.has(el.extractor)) err(`${where}: unknown extractor "${el.extractor}"`);
        if (typeof el.weight !== "number" || el.weight <= 0)
          err(`${where}/${el.id}: weight must be > 0`);
        if (!el.feedbackMissing) err(`${where}/${el.id}: feedbackMissing required`);
        checkTemplate(el.expected, `${where}/${el.id}.expected`);
        checkTemplate(el.feedbackMissing, `${where}/${el.id}.feedbackMissing`);
        if (el.feedbackWrong) checkTemplate(el.feedbackWrong, `${where}/${el.id}.feedbackWrong`);
      }
    } else if (step.type === "atcSay") {
      if (!step.speaker) err(`${where}: speaker required`);
      checkTemplate(step.text, `${where}.text`);
    } else {
      checkTemplate(step.text, `${where}.text`);
    }
  }
  if (!sawEnd) err("no step ends the scenario (next: null)");

  // reachability from the entry step
  const reachable = new Set<string>();
  const queue = [s.steps[0].id];
  const byId = new Map(s.steps.map((st) => [st.id, st]));
  while (queue.length) {
    const id = queue.pop()!;
    if (reachable.has(id)) continue;
    reachable.add(id);
    const step = byId.get(id);
    if (!step) continue;
    const next = step.next;
    if (typeof next === "string") queue.push(next);
    else if (Array.isArray(next)) queue.push(...next.map((b) => b.goTo));
  }
  for (const id of ids) {
    if (!reachable.has(id)) err(`step ${id} is unreachable`);
  }

  if (s.briefing?.atisText) checkTemplate(s.briefing.atisText, "briefing.atisText");
  return errors;
}
