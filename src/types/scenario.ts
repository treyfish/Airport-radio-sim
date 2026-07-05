// Scenario schema — the single source of truth for scenario data files.
// Scenarios are JSON files under src/scenarios/ that conform to `Scenario`.

export type ExtractorId =
  | "facility"
  | "callsign"
  | "runway"
  | "position"
  | "altitude"
  | "frequency"
  | "squawk"
  | "atis"
  | "phrase"
  | "intent";

export interface FrequencyEntry {
  name: string; // "CTAF", "Ground", "Tower"
  mhz: string; // "122.8"
}

export interface Briefing {
  airport: string; // "Springdale Muni (KASG)"
  description: string; // situation narrative shown before starting
  aircraft: string; // "Cessna 172"
  atisText?: string; // template, rendered with variables (Level 2+)
  frequencies: FrequencyEntry[];
}

export interface VariableSpec {
  name: string; // "rwy", "wind_dir", "altimeter", "squawk"
  kind: "choice" | "range" | "callsign" | "fixed";
  choices?: string[]; // kind=choice
  range?: { min: number; max: number; step?: number; decimals?: number };
  value?: string; // kind=fixed
}

export interface RequiredElement {
  id: string; // "who_calling", "runway_readback"
  label: string; // feedback name: "the runway assignment readback"
  extractor: ExtractorId;
  expected: string; // template: "{rwy}" | "{callsign}" | literal phrase
  required: boolean; // false = credited but not penalized
  weight: number; // rubric points, normalized across the call
  feedbackMissing: string;
  feedbackWrong?: string; // may reference {heard} and any env var
}

export interface ExpectedCall {
  elements: RequiredElement[];
}

export interface Branch {
  when: "random" | "always";
  weight?: number; // for random
  goTo: string;
}

export type NextRef = string | Branch[] | null;

export interface StudentCallStep {
  id: string;
  type: "studentCall";
  prompt: string; // situational cue: "You're holding short of 18, ready to depart"
  hint: string; // full model call, template-rendered
  call: ExpectedCall;
  next: NextRef;
}

export interface AtcSayStep {
  id: string;
  type: "atcSay";
  speaker: string; // "Tower", "Ground", "Traffic", "ATIS"
  text: string; // template
  setsVariables?: Record<string, string>; // e.g. {"squawk": "{gen:squawk}"}
  setsFrequency?: string; // template; updates the radio's active frequency display
  next: NextRef;
}

export interface EventStep {
  id: string;
  type: "event";
  text: string; // non-radio event: "You turn crosswind."
  next: NextRef;
}

export type Step = StudentCallStep | AtcSayStep | EventStep;

export interface Scenario {
  id: string;
  level: 1 | 2 | 3 | 4;
  title: string;
  briefing: Briefing;
  variables: VariableSpec[];
  steps: Step[]; // first step is the entry point
  passingScore: number; // 0–100 for the whole scenario
}
