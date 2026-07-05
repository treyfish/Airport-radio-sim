// Listening drills: the other half of radio work. Copy drills read you a
// transmission and you fill in the numbers; the discrimination drill plays a
// stream of calls and you decide which were for YOU.

import { mulberry32, type Rng } from "../engine/variables";
import { generateValue } from "../engine/variables";
import { canonicalize } from "../grader/normalizer";
import { similarCallsign, randomTraffic } from "../engine/chatter";

export interface CopyField {
  key: string;
  label: string;
  expected: string;
  placeholder: string;
}

export interface CopyRound {
  kind: "copy";
  speaker: string;
  transmission: string;
  fields: CopyField[];
}

export interface DiscriminationRound {
  kind: "discriminate";
  calls: { text: string; isMine: boolean }[];
  callsign: string;
}

export type DrillRound = CopyRound | DiscriminationRound;

export interface DrillSpec {
  id: string;
  title: string;
  description: string;
  icon: string;
  make(rng: Rng, callsign: string): DrillRound;
}

function pick<T>(rng: Rng, items: T[]): T {
  return items[Math.floor(rng() * items.length)];
}

const PHONETIC = ["alpha", "bravo", "charlie", "delta", "echo", "foxtrot", "golf", "hotel", "kilo", "lima", "mike", "papa", "romeo", "sierra", "tango", "victor", "whiskey", "yankee"];

const atisCopy: DrillSpec = {
  id: "atis-copy",
  title: "Copy the ATIS",
  description: "Listen to a full ATIS broadcast and write down the pieces that matter. Replay if you need to — but pros get it in one.",
  icon: "🌤",
  make(rng) {
    const info = pick(rng, PHONETIC);
    const windDir = String(pick(rng, [8, 10, 12, 14, 16, 22, 27, 31, 33]) * 10).padStart(3, "0");
    const windKt = String(4 + Math.floor(rng() * 14));
    const altimeter = (29.75 + Math.floor(rng() * 51) / 100).toFixed(2);
    const rwy = pick(rng, ["9", "13", "18", "22", "27", "31", "36"]);
    const visibility = pick(rng, ["one zero", "seven", "fife"]);
    return {
      kind: "copy",
      speaker: "ATIS",
      transmission:
        `Centerville Regional information ${info}. Wind ${windDir} at ${windKt}. ` +
        `Visibility ${visibility}. Sky clear. Altimeter ${altimeter}. ` +
        `Landing and departing runway ${rwy}. Advise on initial contact you have information ${info}.`,
      fields: [
        { key: "info", label: "Information letter", expected: info, placeholder: "e.g. Bravo or B" },
        { key: "wind_dir", label: "Wind direction", expected: windDir, placeholder: "e.g. 270" },
        { key: "wind_kt", label: "Wind speed (kt)", expected: windKt, placeholder: "e.g. 8" },
        { key: "altimeter", label: "Altimeter", expected: altimeter, placeholder: "e.g. 29.92" },
        { key: "rwy", label: "Runway in use", expected: rwy, placeholder: "e.g. 27" },
      ],
    };
  },
};

const clearanceCopy: DrillSpec = {
  id: "clearance-copy",
  title: "Copy the clearance",
  description: "A Class C departure clearance, read at controller speed: heading, altitude, frequency, squawk. Pen ready.",
  icon: "📝",
  make(rng, callsign) {
    const hdg = String(pick(rng, [4, 7, 9, 13, 18, 22, 24, 27, 30, 33]) * 10).padStart(3, "0");
    const altThousands = pick(rng, [2, 3, 4]);
    const altHundreds = pick(rng, [0, 5]);
    const altitude = String(altThousands * 1000 + altHundreds * 100);
    const altSpoken = `${["", "one", "two", "three", "four"][altThousands]} thousand${altHundreds ? " five hundred" : ""}`;
    const freq = pick(rng, ["119.2", "124.7", "126.4", "121.35", "118.25"]);
    const squawk = generateValue("squawk", rng);
    return {
      kind: "copy",
      speaker: "Clearance",
      transmission:
        `Skyhawk ${callsign}, Metro Clearance. Cleared out of the Metro Class Charlie airspace. ` +
        `On departure, fly heading ${hdg}, maintain at or below ${altSpoken}. ` +
        `Departure frequency ${freq}, squawk ${squawk}.`,
      fields: [
        { key: "hdg", label: "Heading", expected: hdg, placeholder: "e.g. 270" },
        { key: "alt", label: "Altitude (at or below, ft)", expected: altitude, placeholder: "e.g. 2500" },
        { key: "freq", label: "Departure frequency", expected: freq, placeholder: "e.g. 119.2" },
        { key: "squawk", label: "Squawk", expected: squawk, placeholder: "e.g. 4064" },
      ],
    };
  },
};

const whoseCall: DrillSpec = {
  id: "whose-call",
  title: "Whose call is it?",
  description: "Eight rapid-fire calls — some for you, some for callsigns one character off yours. The skill that keeps you from taking someone else's clearance.",
  icon: "👂",
  make(rng, callsign) {
    const instructions = [
      "runway 27, cleared to land",
      "runway 27, cleared for takeoff",
      "hold short runway 27, landing traffic",
      "turn left heading 240",
      "contact ground point seven",
      "traffic two o'clock, three miles, northbound",
      "squawk 4215",
      "extend downwind, I'll call your base",
      "number two, follow the Cherokee on final",
      "taxi to the ramp via alpha",
    ];
    const shuffled = [...instructions].sort(() => rng() - 0.5).slice(0, 8);
    const calls = shuffled.map((instruction) => {
      const roll = rng();
      let target: string;
      let isMine = false;
      if (roll < 0.45) {
        target = `Skyhawk ${callsign}`;
        isMine = true;
      } else if (roll < 0.8) {
        target = `Skyhawk ${similarCallsign(callsign, rng)}`;
      } else {
        target = randomTraffic(rng);
      }
      return { text: `${target}, ${instruction}.`, isMine };
    });
    // guarantee at least two of each kind so the drill can't be degenerate
    if (!calls.some((c) => c.isMine)) {
      calls[0] = { text: `Skyhawk ${callsign}, ${shuffled[0]}.`, isMine: true };
    }
    if (calls.every((c) => c.isMine)) {
      calls[1] = { text: `Skyhawk ${similarCallsign(callsign, rng)}, ${shuffled[1]}.`, isMine: false };
    }
    return { kind: "discriminate", calls, callsign };
  },
};

export const DRILLS: DrillSpec[] = [atisCopy, clearanceCopy, whoseCall];

export function getDrill(id: string): DrillSpec | undefined {
  return DRILLS.find((d) => d.id === id);
}

export function makeRound(spec: DrillSpec, callsign: string, seed?: number): DrillRound {
  const rng = mulberry32(seed ?? Math.floor(Math.random() * 2 ** 31));
  return spec.make(rng, callsign || "N123AB");
}

/**
 * Tolerant answer check: both sides are canonicalized (digits exploded,
 * phonetic words folded) and compared without separators, so "two niner
 * niner two", "29.92", and "2992" all match an expected "29.92".
 */
export function checkAnswer(user: string, expected: string): boolean {
  const canon = (s: string) => canonicalize(s).join("").replace(/[^a-z0-9]/g, "");
  const u = canon(user);
  const e = canon(expected);
  if (!u) return false;
  if (u === e) return true;
  // allow a leading label ("runway 27") and dropped leading zeros ("090" vs "90")
  return u.endsWith(e) || u.replace(/^0+/, "") === e.replace(/^0+/, "");
}
