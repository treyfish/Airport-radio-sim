import { useMemo, useState } from "react";
import { GLOSSARY } from "../content/glossary";

export default function Glossary({ onBack }: { onBack(): void }) {
  const [query, setQuery] = useState("");

  const entries = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = [...GLOSSARY].sort((a, b) => a.term.localeCompare(b.term));
    if (!q) return all;
    return all.filter(
      (e) => e.term.toLowerCase().includes(q) || e.definition.toLowerCase().includes(q),
    );
  }, [query]);

  return (
    <main className="glossary">
      <button className="link-btn" onClick={onBack}>← back</button>
      <h2>Glossary</h2>
      <input
        placeholder="Search terms… (e.g. squawk, readback, Bravo)"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
      />
      <div className="glossary-list">
        {entries.map((e) => (
          <div key={e.term} className="glossary-entry card">
            <h3>{e.term}</h3>
            <p>{e.definition}</p>
          </div>
        ))}
        {entries.length === 0 && <p className="event-line">No matches for “{query}”.</p>}
      </div>
    </main>
  );
}
