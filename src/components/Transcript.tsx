import { useEffect, useRef } from "react";
import type { GradeResult } from "../grader/grader";

export interface TranscriptEntry {
  kind: "atc" | "you" | "event" | "coach" | "other";
  speaker?: string;
  text: string;
  grade?: GradeResult;
}

export default function Transcript({ entries }: { entries: TranscriptEntry[] }) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [entries.length]);

  return (
    <div className="transcript" role="log" aria-live="polite">
      {entries.map((entry, i) => {
        switch (entry.kind) {
          case "atc":
            return (
              <div key={i} className="bubble atc">
                <span className="speaker">{entry.speaker}</span>
                <p>{entry.text}</p>
              </div>
            );
          case "other":
            return (
              <div key={i} className="bubble other">
                <span className="speaker">{entry.speaker}</span>
                <p>{entry.text}</p>
              </div>
            );
          case "you":
            return (
              <div key={i} className="bubble you">
                <span className="speaker">You</span>
                <p>{entry.text}</p>
              </div>
            );
          case "coach":
            return (
              <div key={i} className="bubble coach">
                <p>{entry.text}</p>
                {entry.grade && entry.grade.styleNotes.length > 0 && (
                  <ul className="style-notes">
                    {entry.grade.styleNotes.map((note, j) => (
                      <li key={j}>{note}</li>
                    ))}
                  </ul>
                )}
              </div>
            );
          default:
            return (
              <div key={i} className="event-line">
                {entry.text}
              </div>
            );
        }
      })}
      <div ref={bottomRef} />
    </div>
  );
}
