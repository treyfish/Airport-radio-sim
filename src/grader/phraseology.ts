// Static phraseology data: phonetic alphabet, number words, and coaching patterns.

export const PHONETIC_ALPHABET: Record<string, string> = {
  alpha: "a", alfa: "a",
  bravo: "b",
  charlie: "c",
  delta: "d",
  echo: "e",
  foxtrot: "f",
  golf: "g",
  hotel: "h",
  india: "i",
  juliet: "j", juliett: "j",
  kilo: "k",
  lima: "l",
  mike: "m",
  november: "n",
  oscar: "o",
  papa: "p",
  quebec: "q",
  romeo: "r",
  sierra: "s",
  tango: "t",
  uniform: "u",
  victor: "v",
  whiskey: "w",
  xray: "x", "x-ray": "x",
  yankee: "y",
  zulu: "z",
};

// Single-digit words, including aviation pronunciations and common
// speech-recognition spellings.
export const DIGIT_WORDS: Record<string, string> = {
  zero: "0", oh: "0",
  one: "1", won: "1",
  two: "2", to: "2", too: "2",
  three: "3", tree: "3",
  four: "4", for: "4",
  five: "5", fife: "5",
  six: "6",
  seven: "7",
  eight: "8", ate: "8",
  nine: "9", niner: "9",
};

// Multi-digit number words → digit strings (exploded later by the normalizer).
export const TENS_WORDS: Record<string, string> = {
  ten: "10", eleven: "11", twelve: "12", thirteen: "13", fourteen: "14",
  fifteen: "15", sixteen: "16", seventeen: "17", eighteen: "18", nineteen: "19",
  twenty: "20", thirty: "30", forty: "40", fifty: "50",
  sixty: "60", seventy: "70", eighty: "80", ninety: "90",
};

export const DECIMAL_WORDS = new Set(["point", "decimal", "dot"]);

// Words kept intact through normalization because extractors use them
// structurally (altitudes like "3 thousand 5 hundred").
export const MAGNITUDE_WORDS = new Set(["hundred", "thousand"]);

// Aircraft-type synonyms fold to a canonical token so "Skyhawk 3AB" matches
// a "Cessna 3AB" callsign abbreviation.
export const AIRCRAFT_SYNONYMS: Record<string, string> = {
  skyhawk: "cessna",
  sessna: "cessna", // common speech-recognition mangling
  cesna: "cessna",
};

// Style-coaching patterns checked against RAW text (before normalization).
// Advisory only — never deducts points. Voice input suppresses the
// pronunciation notes because recognizers transcribe "niner" unpredictably.
export interface StylePattern {
  pattern: RegExp;
  note: string;
  textModeOnly: boolean;
}

export const STYLE_PATTERNS: StylePattern[] = [
  {
    pattern: /\bnine\b(?!r)/i,
    note: "In aviation, say “niner” instead of “nine” — it can't be confused with “five” over a scratchy radio.",
    textModeOnly: true,
  },
  {
    pattern: /\bthree\b/i,
    note: "Pros pronounce 3 as “tree” on the radio.",
    textModeOnly: true,
  },
  {
    pattern: /\bfive\b/i,
    note: "Pros pronounce 5 as “fife” on the radio.",
    textModeOnly: true,
  },
  {
    pattern: /\bwith you\b/i,
    note: "Skip “with you” — controllers know you're with them. Just state your callsign and altitude.",
    textModeOnly: false,
  },
  {
    pattern: /\bany (traffic|conflicting traffic).{0,30}please advise\b/i,
    note: "“Any traffic please advise” is specifically discouraged by the AIM — just make your position calls.",
    textModeOnly: false,
  },
  {
    pattern: /\broger\b.{0,20}\b(runway|cleared|hold)\b/i,
    note: "“Roger” only means “I heard you” — clearances need a full readback, not a roger.",
    textModeOnly: false,
  },
];
