// Radio sound effects, synthesized with the Web Audio API — no audio assets.
// SpeechSynthesis output can't be routed through Web Audio, so realism comes
// from layering: a low static bed under ATC transmissions plus squelch click
// bursts at key/unkey, all through a 300–3000 Hz bandpass like a real comm.

let ctx: AudioContext | null = null;
let bedGain: GainNode | null = null;
let bedSource: AudioBufferSourceNode | null = null;

function ensureContext(): AudioContext | null {
  if (typeof AudioContext === "undefined") return null;
  if (!ctx) ctx = new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

/** Call from a user gesture (Start button / PTT) to satisfy autoplay policies. */
export function unlockAudio(): void {
  ensureContext();
}

function noiseBuffer(context: AudioContext, seconds: number): AudioBuffer {
  const buffer = context.createBuffer(1, context.sampleRate * seconds, context.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buffer;
}

function bandpass(context: AudioContext): BiquadFilterNode {
  const filter = context.createBiquadFilter();
  filter.type = "bandpass";
  filter.frequency.value = 1650; // center of the 300–3000 Hz voice band
  filter.Q.value = 0.5;
  return filter;
}

/** Short static burst — the squelch click at transmission start/end. */
export function playSquelch(): void {
  const context = ensureContext();
  if (!context) return;
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, 0.06);
  const gain = context.createGain();
  gain.gain.setValueAtTime(0.18, context.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.06);
  source.connect(bandpass(context)).connect(gain).connect(context.destination);
  source.start();
}

/** Start the low static bed under an incoming transmission. */
export function startStaticBed(): void {
  const context = ensureContext();
  if (!context || bedSource) return;
  bedSource = context.createBufferSource();
  bedSource.buffer = noiseBuffer(context, 2);
  bedSource.loop = true;
  bedGain = context.createGain();
  bedGain.gain.setValueAtTime(0.0001, context.currentTime);
  bedGain.gain.exponentialRampToValueAtTime(0.035, context.currentTime + 0.05);
  bedSource.connect(bandpass(context)).connect(bedGain).connect(context.destination);
  bedSource.start();
}

/** Fade out and stop the static bed (~150 ms after the transmission ends). */
export function stopStaticBed(): void {
  const context = ctx;
  if (!context || !bedSource || !bedGain) return;
  const source = bedSource;
  bedGain.gain.exponentialRampToValueAtTime(0.0001, context.currentTime + 0.15);
  bedSource = null;
  bedGain = null;
  setTimeout(() => {
    try {
      source.stop();
    } catch {
      // already stopped
    }
  }, 200);
}
