import { useState } from "react";
import type { LessonDeck } from "../content/lessons";

interface Props {
  deck: LessonDeck;
  onDone(): void; // completes the lesson (records progress) and returns
  onBack(): void;
}

function renderBody(body: string) {
  return body.split("\n\n").map((block, i) => {
    const lines = block.split("\n");
    if (lines.every((l) => l.startsWith("- "))) {
      return (
        <ul key={i}>
          {lines.map((l, j) => (
            <li key={j}>{l.slice(2)}</li>
          ))}
        </ul>
      );
    }
    return <p key={i}>{block}</p>;
  });
}

export default function Lesson({ deck, onDone, onBack }: Props) {
  const [index, setIndex] = useState(0);
  const card = deck.cards[index];
  const isLast = index === deck.cards.length - 1;

  return (
    <main className="lesson card">
      <button className="link-btn" onClick={onBack}>← back</button>
      <p className="lesson-deck-title">{deck.title}</p>
      <div className="lesson-progress">
        {deck.cards.map((_, i) => (
          <span key={i} className={`dot ${i <= index ? "filled" : ""}`} />
        ))}
      </div>
      <h2>{card.title}</h2>
      <div className="lesson-body">{renderBody(card.body)}</div>
      <div className="lesson-nav">
        <button className="link-btn" disabled={index === 0} onClick={() => setIndex(index - 1)}>
          ← previous
        </button>
        {isLast ? (
          <button className="primary-btn" onClick={onDone}>Done — start practicing</button>
        ) : (
          <button className="primary-btn" onClick={() => setIndex(index + 1)}>Next →</button>
        )}
      </div>
    </main>
  );
}
