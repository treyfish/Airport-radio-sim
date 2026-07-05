// SpeechRecognition wrapper with feature detection. The Radio screen uses
// push-to-talk: start() on key, stop() on unkey; interim results stream to
// the UI; the final transcript is confirmed by the student before grading.

export function recognitionAvailable(): boolean {
  return (
    typeof window !== "undefined" &&
    Boolean(window.SpeechRecognition ?? window.webkitSpeechRecognition)
  );
}

export interface PttSession {
  stop(): void;
  abort(): void;
}

export interface PttCallbacks {
  onInterim(text: string): void;
  onFinal(text: string): void;
  onError(error: string): void;
}

export function startPtt(callbacks: PttCallbacks): PttSession | null {
  const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.lang = "en-US";
  recognition.continuous = true;
  recognition.interimResults = true;
  recognition.maxAlternatives = 1;

  const finals: string[] = [];
  let done = false;

  recognition.onresult = (event) => {
    let interim = "";
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finals.push(result[0].transcript.trim());
      else interim += result[0].transcript;
    }
    const soFar = [...finals, interim.trim()].filter(Boolean).join(" ");
    callbacks.onInterim(soFar);
  };

  recognition.onerror = (event) => {
    if (done) return;
    done = true;
    // "no-speech"/"aborted" are routine; report others
    if (event.error !== "no-speech" && event.error !== "aborted") {
      callbacks.onError(event.error);
    } else {
      callbacks.onFinal(finals.join(" ").trim());
    }
  };

  recognition.onend = () => {
    if (done) return;
    done = true;
    callbacks.onFinal(finals.join(" ").trim());
  };

  recognition.start();
  return {
    stop: () => recognition.stop(),
    abort: () => {
      done = true;
      recognition.abort();
    },
  };
}
