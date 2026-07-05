// Variable resolution: turn a scenario's VariableSpec list into a concrete
// env for one run. Seedable RNG (mulberry32) so tests are deterministic.

import type { VariableSpec } from "../types/scenario";
import type { Env } from "./templates";

export type Rng = () => number;

export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

function randomCallsign(rng: Rng): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ"; // no I/O (avoid 1/0 confusion)
  const digits = () => Math.floor(rng() * 10);
  return `N${digits()}${digits()}${digits()}${pick(rng, [...letters])}${pick(rng, [...letters])}`;
}

export function resolveVariables(
  specs: VariableSpec[],
  rng: Rng,
  settings: { callsign?: string },
): Env {
  const env: Env = {};
  for (const spec of specs) {
    switch (spec.kind) {
      case "fixed":
        env[spec.name] = spec.value ?? "";
        break;
      case "choice":
        env[spec.name] = pick(rng, spec.choices ?? [""]);
        break;
      case "range": {
        const { min, max, step = 1, decimals = 0 } = spec.range ?? { min: 0, max: 0 };
        const steps = Math.floor((max - min) / step);
        const value = min + Math.floor(rng() * (steps + 1)) * step;
        env[spec.name] = value.toFixed(decimals);
        break;
      }
      case "callsign":
        env[spec.name] = settings.callsign?.trim() || randomCallsign(rng);
        break;
    }
  }
  return env;
}

/** Generators usable in AtcSayStep.setsVariables values, e.g. "{gen:squawk}". */
export function generateValue(kind: string, rng: Rng): string {
  switch (kind) {
    case "squawk": {
      // 4 digits, each 0–7, avoiding special codes (12xx, 7500/7600/7700)
      let code: string;
      do {
        code = Array.from({ length: 4 }, () => Math.floor(rng() * 8)).join("");
      } while (code.startsWith("12") || ["7500", "7600", "7700", "0000"].includes(code));
      return code;
    }
    default:
      return "";
  }
}
