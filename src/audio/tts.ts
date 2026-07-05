// SpeechSynthesis wrapper: speaks ATC/ATIS lines one at a time with the
// radio static bed and squelch clicks layered around each transmission.
// Chrome sometimes never fires utterance.onend, so a duration-estimate
// timeout guarantees the channel is released.

import { playSquelch, startStaticBed, stopStaticBed } from "./radioFx";

export interface SpeakOptions {
  speaker?: string; // used to vary pitch so Ground vs Tower sound different
  fx?: boolean; // radio static/squelch layer
}

let speaking = false;

function pickVoice(): SpeechSynthesisVoice | null {
  const voices = speechSynthesis.getVoices();
  return (
    voices.find((v) => v.lang === "en-US" && v.localService) ??
    voices.find((v) => v.lang === "en-US") ??
    voices.find((v) => v.lang.startsWith("en")) ??
    null
  );
}

function pitchFor(speaker: string): number {
  // Small deterministic variation per speaker role so facilities sound distinct.
  let hash = 0;
  for (const ch of speaker) hash = (hash * 31 + ch.charCodeAt(0)) % 997;
  return 0.85 + (hash % 5) * 0.075; // 0.85–1.15
}

export function ttsAvailable(): boolean {
  return typeof speechSynthesis !== "undefined";
}

export function isSpeaking(): boolean {
  return speaking;
}

/** Speak a transmission; resolves when it (and its radio FX tail) finish. */
export function speak(text: string, opts: SpeakOptions = {}): Promise<void> {
  if (!ttsAvailable()) return Promise.resolve();
  const { speaker = "ATC", fx = true } = opts;

  return new Promise((resolve) => {
    const utterance = new SpeechSynthesisUtterance(text);
    const voice = pickVoice();
    if (voice) utterance.voice = voice;
    utterance.rate = speaker === "ATIS" ? 1.05 : 1.15;
    utterance.pitch = pitchFor(speaker);

    let finished = false;
    const finish = () => {
      if (finished) return;
      finished = true;
      speaking = false;
      if (fx) {
        stopStaticBed();
        playSquelch();
      }
      resolve();
    };

    // fallback: ~350 ms per word + 1.5 s, in case onend never fires
    const words = text.split(/\s+/).length;
    const timeout = setTimeout(finish, words * 350 + 1500);

    utterance.onend = () => {
      clearTimeout(timeout);
      finish();
    };
    utterance.onerror = () => {
      clearTimeout(timeout);
      finish();
    };

    speaking = true;
    if (fx) {
      playSquelch();
      startStaticBed();
    }
    speechSynthesis.cancel(); // clear any stuck queue
    speechSynthesis.speak(utterance);
  });
}

export function stopSpeaking(): void {
  if (!ttsAvailable()) return;
  speechSynthesis.cancel();
  speaking = false;
  stopStaticBed();
}

// Some browsers load voices asynchronously; touching getVoices() early warms them up.
if (ttsAvailable()) {
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}
