// Stage 1 of the grading pipeline: raw text → lowercase word tokens.
// Keeps '.' when it sits between digits ("122.8") and '-' inside words
// ("x-ray") so later stages can interpret them.

export function tokenize(raw: string): string[] {
  const cleaned = raw
    .toLowerCase()
    // strip punctuation except dots and hyphens, which get special handling
    .replace(/[^a-z0-9.\-\s]/g, " ")
    // dots not between two digits are noise (end of sentence etc.)
    .replace(/(?<![0-9])\.|\.(?![0-9])/g, " ")
    // hyphens between digits or at word edges are noise; keep letter-letter ("x-ray")
    .replace(/(?<![a-z])-|-(?![a-z])/g, " ");
  return cleaned.split(/\s+/).filter((t) => t.length > 0);
}
