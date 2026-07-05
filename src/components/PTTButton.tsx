// Push-to-talk. Desktop: hold to talk (pointerdown/up). Touch: tap to key,
// tap again to unkey — holding fights with scroll and long-press on mobile.

import { useRef } from "react";

interface Props {
  state: "idle" | "keyed" | "review";
  disabled: boolean;
  interim: string;
  onKeyDown(): void;
  onKeyUp(): void;
}

export default function PTTButton({ state, disabled, interim, onKeyDown, onKeyUp }: Props) {
  const isTouchRef = useRef(false);

  return (
    <div className="ptt-wrap">
      <button
        type="button"
        className={`ptt-btn ${state === "keyed" ? "keyed" : ""}`}
        disabled={disabled}
        onPointerDown={(e) => {
          isTouchRef.current = e.pointerType === "touch";
          if (isTouchRef.current) return; // touch uses tap-toggle via onClick
          e.preventDefault();
          onKeyDown();
        }}
        onPointerUp={(e) => {
          if (isTouchRef.current) return;
          e.preventDefault();
          onKeyUp();
        }}
        onPointerLeave={() => {
          if (!isTouchRef.current && state === "keyed") onKeyUp();
        }}
        onClick={() => {
          if (!isTouchRef.current) return;
          if (state === "keyed") onKeyUp();
          else onKeyDown();
        }}
      >
        {state === "keyed" ? "◉ TRANSMITTING — release to stop" : "🎙 HOLD TO TALK"}
      </button>
      {state === "keyed" && <p className="interim">{interim || "listening…"}</p>}
    </div>
  );
}
