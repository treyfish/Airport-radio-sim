// Scenario engine: a pure state machine that walks a scenario's steps,
// resolves branches, tracks the variable env, and grades student calls
// through the pluggable Grader interface. No DOM — fully unit-testable.

import type {
  Scenario,
  Step,
  StudentCallStep,
  AtcSayStep,
  EventStep,
  NextRef,
  Branch,
} from "../types/scenario";
import { renderTemplate, type Env } from "./templates";
import { mulberry32, resolveVariables, generateValue, type Rng } from "./variables";
import {
  defaultGrader,
  type Grader,
  type GradeResult,
  type GradeOptions,
  type CallTiming,
} from "../grader/grader";

export const MAX_ATTEMPTS = 3; // first try + 2 retries

export interface StepResult {
  stepId: string;
  prompt: string;
  hint: string;
  attempts: { input: string; grade: GradeResult; timing?: CallTiming }[];
  bestGrade: GradeResult;
  hintUsed: boolean;
  /** step score after hint cap */
  finalScore: number;
}

export interface EngineSettings {
  callsign?: string;
  seed?: number;
  grader?: Grader;
}

export type EngineEvent =
  | { kind: "atc"; speaker: string; text: string }
  | { kind: "event"; text: string }
  | { kind: "frequency"; mhz: string }
  | { kind: "awaitCall"; step: StudentCallStep; prompt: string; hint: string }
  | { kind: "sayAgain"; speaker: string; text: string }
  | { kind: "end" };

const HINT_SCORE_CAP = 80;

export class ScenarioEngine {
  readonly scenario: Scenario;
  readonly env: Env;
  private rng: Rng;
  private grader: Grader;
  private stepsById: Map<string, Step>;
  private currentId: string | null;
  private stepResults: StepResult[] = [];
  private pending: StepResult | null = null;
  private ended = false;

  constructor(scenario: Scenario, settings: EngineSettings = {}) {
    this.scenario = scenario;
    this.rng = mulberry32(settings.seed ?? Math.floor(Math.random() * 2 ** 31));
    this.grader = settings.grader ?? defaultGrader;
    this.env = resolveVariables(scenario.variables, this.rng, {
      callsign: settings.callsign,
    });
    this.stepsById = new Map(scenario.steps.map((s) => [s.id, s]));
    this.currentId = scenario.steps[0]?.id ?? null;
  }

  render(template: string): string {
    return renderTemplate(template, this.env);
  }

  private resolveNext(next: NextRef): string | null {
    if (next === null) return null;
    if (typeof next === "string") return next;
    return this.pickBranch(next);
  }

  private pickBranch(branches: Branch[]): string | null {
    const always = branches.find((b) => b.when === "always");
    if (always) return always.goTo;
    const randoms = branches.filter((b) => b.when === "random");
    const total = randoms.reduce((sum, b) => sum + (b.weight ?? 1), 0);
    let roll = this.rng() * total;
    for (const b of randoms) {
      roll -= b.weight ?? 1;
      if (roll <= 0) return b.goTo;
    }
    return randoms[randoms.length - 1]?.goTo ?? null;
  }

  private applyAtcSideEffects(step: AtcSayStep): EngineEvent[] {
    const extras: EngineEvent[] = [];
    if (step.setsVariables) {
      for (const [name, valueTemplate] of Object.entries(step.setsVariables)) {
        const genMatch = /^\{gen:([a-z]+)\}$/.exec(valueTemplate);
        this.env[name] = genMatch
          ? generateValue(genMatch[1], this.rng)
          : this.render(valueTemplate);
      }
    }
    if (step.setsFrequency) {
      extras.push({ kind: "frequency", mhz: this.render(step.setsFrequency) });
    }
    return extras;
  }

  /**
   * Advance until the next student call (or end), returning every event on
   * the way: ATC transmissions, non-radio events, frequency changes.
   */
  advance(): EngineEvent[] {
    const events: EngineEvent[] = [];
    while (this.currentId !== null) {
      const step = this.stepsById.get(this.currentId);
      if (!step) break;
      if (step.type === "studentCall") {
        this.pending = this.pending?.stepId === step.id ? this.pending : {
          stepId: step.id,
          prompt: this.render(step.prompt),
          hint: this.render(step.hint),
          attempts: [],
          bestGrade: { score: 0, passed: false, elements: [], styleNotes: [] },
          hintUsed: false,
          finalScore: 0,
        };
        events.push({
          kind: "awaitCall",
          step,
          prompt: this.pending.prompt,
          hint: this.pending.hint,
        });
        return events;
      }
      if (step.type === "atcSay") {
        // side effects run BEFORE rendering so a step can assign then speak a value
        events.push(...this.applyAtcSideEffects(step));
        events.push({ kind: "atc", speaker: step.speaker, text: this.render(step.text) });
      } else {
        events.push({ kind: "event", text: this.render((step as EventStep).text) });
      }
      this.currentId = this.resolveNext(step.next);
    }
    this.ended = true;
    events.push({ kind: "end" });
    return events;
  }

  markHintUsed(): void {
    if (this.pending) this.pending.hintUsed = true;
  }

  /**
   * Grade the student's call for the pending studentCall step. Advances past
   * the step when passed or out of attempts; otherwise the caller should show
   * the "say again" event and wait for another attempt.
   */
  submitStudentCall(
    raw: string,
    opts: GradeOptions = {},
  ): { grade: GradeResult; advanced: boolean; sayAgain?: EngineEvent } {
    const step = this.currentId ? this.stepsById.get(this.currentId) : undefined;
    if (!step || step.type !== "studentCall" || !this.pending) {
      throw new Error("No student call is pending");
    }
    const grade = this.grader.grade(raw, step.call, this.env, opts);
    this.pending.attempts.push({ input: raw, grade, timing: opts.timing });
    if (grade.score >= this.pending.bestGrade.score || this.pending.attempts.length === 1) {
      this.pending.bestGrade = grade;
    }

    const outOfAttempts = this.pending.attempts.length >= MAX_ATTEMPTS;
    if (grade.passed || outOfAttempts) {
      this.pending.finalScore = this.pending.hintUsed
        ? Math.min(this.pending.bestGrade.score, HINT_SCORE_CAP)
        : this.pending.bestGrade.score;
      this.stepResults.push(this.pending);
      this.pending = null;
      this.currentId = this.resolveNext(step.next);
      return { grade, advanced: true };
    }

    const speaker = this.sayAgainSpeaker();
    return {
      grade,
      advanced: false,
      sayAgain: {
        kind: "sayAgain",
        speaker,
        text:
          speaker === "Traffic"
            ? "(Your call was unclear — other pilots can't picture where you are.)"
            : this.render("{callsign}, say again."),
      },
    };
  }

  private sayAgainSpeaker(): string {
    // Use the most recent ATC speaker; CTAF scenarios have no controller.
    for (let i = this.scenario.steps.length - 1; i >= 0; i--) {
      const s = this.scenario.steps[i];
      if (s.type === "atcSay" && s.speaker !== "ATIS") return s.speaker;
    }
    return "Traffic";
  }

  isEnded(): boolean {
    return this.ended;
  }

  results(): StepResult[] {
    return this.stepResults;
  }

  /** Overall scenario score: mean of per-step final scores. */
  totalScore(): number {
    if (this.stepResults.length === 0) return 0;
    const sum = this.stepResults.reduce((acc, r) => acc + r.finalScore, 0);
    return Math.round(sum / this.stepResults.length);
  }

  passed(): boolean {
    return this.totalScore() >= this.scenario.passingScore;
  }
}
