// Background-traffic generator: plausible radio calls from OTHER aircraft,
// plus "distractor" calls addressed to callsigns similar to the student's —
// the party-line realism no scripted exchange provides.

import type { Scenario } from "../types/scenario";
import type { Env } from "./templates";
import type { Rng } from "./variables";

export interface ChatterCall {
  speaker: string;
  text: string;
  /** addressed to a similar-but-not-your callsign — answering it is the trap */
  isDistractor: boolean;
  /** canonical content phrase for trap detection (e.g. "cleared to land") */
  distractorKey?: string;
  /** the similar callsign the distractor addressed */
  distractorCallsign?: string;
}

const AIRCRAFT_TYPES = ["Cherokee", "Cessna", "Skyhawk", "Warrior", "Bonanza", "Archer", "Citabria", "Mooney"];
const LETTERS = "ABCDEFGHJKLMNPQRSTUVWXYZ";

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function digit(rng: Rng): string {
  return String(Math.floor(rng() * 10));
}

/** A random other-aircraft callsign, spoken style ("Cherokee four five one golf whiskey"). */
export function randomTraffic(rng: Rng): string {
  return `${pick(rng, AIRCRAFT_TYPES)} ${digit(rng)}${digit(rng)}${digit(rng)}${pick(rng, [...LETTERS])}${pick(rng, [...LETTERS])}`;
}

/**
 * A callsign one character off from the student's — same shape, easy to
 * confuse on a busy frequency. Never equal to the original.
 */
export function similarCallsign(callsign: string, rng: Rng): string {
  const chars = callsign.toUpperCase().split("");
  // never mutate the leading "N" — mutate a digit or trailing letter
  const candidates = chars
    .map((c, i) => ({ c, i }))
    .filter(({ c, i }) => i > 0 && /[A-Z0-9]/.test(c));
  if (candidates.length === 0) return callsign + "X";
  for (let attempt = 0; attempt < 10; attempt++) {
    const { c, i } = pick(rng, candidates);
    const replacement = /[0-9]/.test(c)
      ? digit(rng)
      : LETTERS[Math.floor(rng() * LETTERS.length)];
    if (replacement !== c) {
      const mutated = [...chars];
      mutated[i] = replacement;
      return mutated.join("");
    }
  }
  const fallback = [...chars];
  fallback[fallback.length - 1] = fallback[fallback.length - 1] === "Z" ? "Q" : "Z";
  return fallback.join("");
}

interface ChatterContext {
  kind: "ctaf" | "towered" | "radar";
  airportName: string; // "Cedar Valley", "Centerville"
  facility: string; // "Tower", "Approach", or "Traffic" for CTAF
  rwy: string;
}

export function contextFor(scenario: Scenario, env: Env): ChatterContext {
  const airportName = scenario.briefing.airport.split("(")[0].replace(/ (Muni|Rgnl|Intl).*$/i, "").trim();
  const rwy = env.rwy ?? "18";
  if (scenario.level === 1) return { kind: "ctaf", airportName, facility: "Traffic", rwy };
  if (scenario.level === 3) return { kind: "radar", airportName, facility: "Approach", rwy };
  return { kind: "towered", airportName, facility: "Tower", rwy };
}

/** Ambient (non-distractor) chatter: other pilots living their lives. */
function ambientCall(ctx: ChatterContext, rng: Rng): ChatterCall {
  const other = randomTraffic(rng);
  if (ctx.kind === "ctaf") {
    const leg = pick(rng, [
      `left downwind runway ${ctx.rwy}`,
      `left base runway ${ctx.rwy}`,
      `final runway ${ctx.rwy}, full stop`,
      `departing runway ${ctx.rwy}, departing to the ${pick(rng, ["north", "south", "east", "west"])}`,
      `taxiing to runway ${ctx.rwy}`,
      "clear of the runway, taxiing to the ramp",
    ]);
    return {
      speaker: "Other traffic",
      text: `${ctx.airportName} traffic, ${other}, ${leg}, ${ctx.airportName}.`,
      isDistractor: false,
    };
  }
  if (ctx.kind === "radar") {
    const exchange = pick(rng, [
      `${other}, radar contact, maintain VFR.`,
      `${other}, traffic one o'clock, five miles, southbound, altitude indicates four thousand five hundred.`,
      `${other}, contact center one three two point four. Good day.`,
      `${other}, squawk two three one four and ident.`,
    ]);
    return { speaker: ctx.facility, text: exchange, isDistractor: false };
  }
  const exchange = pick(rng, [
    `${other}, runway ${ctx.rwy}, wind calm, cleared to land.`,
    `${other}, runway ${ctx.rwy}, cleared for takeoff.`,
    `${other}, extend downwind, I'll call your base.`,
    `${other}, taxi to the ramp via alpha.`,
    `${other}, hold short runway ${ctx.rwy}, landing traffic.`,
    `${other}, number two, follow the Cherokee on final.`,
  ]);
  return { speaker: ctx.facility, text: exchange, isDistractor: false };
}

/** Distractor: an instruction addressed to a callsign one character off yours. */
function distractorCall(ctx: ChatterContext, env: Env, rng: Rng): ChatterCall {
  const similar = similarCallsign(env.callsign ?? "N123AB", rng);
  if (ctx.kind === "ctaf") {
    // CTAF has no controller; distractor is another aircraft with a similar
    // callsign making a normal call — confusing, but nothing to answer.
    return {
      speaker: "Other traffic",
      text: `${ctx.airportName} traffic, Skyhawk ${similar}, left downwind runway ${ctx.rwy}, ${ctx.airportName}.`,
      isDistractor: true,
      distractorKey: "downwind",
      distractorCallsign: similar,
    };
  }
  const instruction = pick(rng, [
    { text: `runway ${ctx.rwy}, cleared to land`, key: "cleared to land" },
    { text: `runway ${ctx.rwy}, cleared for takeoff`, key: "cleared for takeoff" },
    { text: `hold short runway ${ctx.rwy}`, key: "hold short" },
    { text: "contact ground point seven when clear", key: "contact ground" },
  ]);
  return {
    speaker: ctx.facility,
    text: `Skyhawk ${similar}, ${instruction.text}.`,
    isDistractor: true,
    distractorKey: instruction.key,
    distractorCallsign: similar,
  };
}

export const DISTRACTOR_PROBABILITY = 0.3;

export function generateChatterCall(scenario: Scenario, env: Env, rng: Rng): ChatterCall {
  const ctx = contextFor(scenario, env);
  if (rng() < DISTRACTOR_PROBABILITY) return distractorCall(ctx, env, rng);
  return ambientCall(ctx, rng);
}

/** Chatter cadence by level: mean seconds of idle between injected calls. */
export function chatterIntervalMs(level: number, rng: Rng): number {
  const base = { 1: 14, 2: 10, 3: 9, 4: 7 }[level] ?? 10;
  return (base + rng() * base) * 1000 * 0.7;
}
