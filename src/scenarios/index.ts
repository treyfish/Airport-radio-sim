import type { Scenario } from "../types/scenario";
import ctafPattern from "./level1/ctaf-pattern.json";
import ctafInbound from "./level1/ctaf-inbound.json";
import classdTaxiTakeoff from "./level2/classd-taxi-takeoff.json";
import classdArrival from "./level2/classd-arrival.json";
import classdGoaround from "./level2/classd-goaround.json";
import classdTouchandgo from "./level2/classd-touchandgo.json";
import studentPilotToolkit from "./level2/student-pilot-toolkit.json";
import flightFollowing from "./level3/flight-following.json";
import inflightEmergency from "./level3/inflight-emergency.json";
import classcDeparture from "./level4/classc-departure.json";
import classbTransition from "./level4/classb-transition.json";

export const scenarios: Scenario[] = [
  ctafPattern,
  ctafInbound,
  classdTaxiTakeoff,
  classdArrival,
  classdTouchandgo,
  classdGoaround,
  studentPilotToolkit,
  flightFollowing,
  inflightEmergency,
  classcDeparture,
  classbTransition,
] as Scenario[];

export const LEVEL_TITLES: Record<number, string> = {
  1: "Level 1 — Non-towered field (CTAF)",
  2: "Level 2 — Towered field (Class D)",
  3: "Level 3 — Flight following",
  4: "Level 4 — Class C airspace",
};

export function scenariosByLevel(): Map<number, Scenario[]> {
  const map = new Map<number, Scenario[]>();
  for (const s of scenarios) {
    const list = map.get(s.level) ?? [];
    list.push(s);
    map.set(s.level, list);
  }
  return new Map([...map.entries()].sort((a, b) => a[0] - b[0]));
}

export function getScenario(id: string): Scenario | undefined {
  return scenarios.find((s) => s.id === id);
}
