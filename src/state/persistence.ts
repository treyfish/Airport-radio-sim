// localStorage persistence: settings + per-scenario progress, versioned.

export interface Settings {
  callsign: string;
  ttsOn: boolean;
  fxOn: boolean;
  /** background traffic on the frequency (other aircraft + distractor callsigns) */
  chatterOn: boolean;
}

export interface ScenarioProgress {
  bestScore: number;
  passed: boolean;
  completedAt: string; // ISO date
}

export interface PersistedState {
  version: 1;
  settings: Settings;
  progress: Record<string, ScenarioProgress>;
}

const KEY = "airport-radio-sim:v1";

const DEFAULTS: PersistedState = {
  version: 1,
  settings: { callsign: "", ttsOn: true, fxOn: true, chatterOn: true },
  progress: {},
};

export function loadState(): PersistedState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(DEFAULTS);
    const parsed = JSON.parse(raw) as PersistedState;
    if (parsed.version !== 1) return structuredClone(DEFAULTS);
    return {
      ...structuredClone(DEFAULTS),
      ...parsed,
      settings: { ...DEFAULTS.settings, ...parsed.settings },
    };
  } catch {
    return structuredClone(DEFAULTS);
  }
}

export function saveState(state: PersistedState): void {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // storage full or unavailable — practice still works, progress just won't stick
  }
}

export function recordResult(scenarioId: string, score: number, passed: boolean): PersistedState {
  const state = loadState();
  const prior = state.progress[scenarioId];
  if (!prior || score > prior.bestScore) {
    state.progress[scenarioId] = {
      bestScore: score,
      passed: passed || (prior?.passed ?? false),
      completedAt: new Date().toISOString(),
    };
  } else if (passed && !prior.passed) {
    state.progress[scenarioId] = { ...prior, passed: true };
  }
  saveState(state);
  return state;
}

export function saveSettings(settings: Settings): PersistedState {
  const state = loadState();
  state.settings = settings;
  saveState(state);
  return state;
}

/** A level is unlocked when any scenario of the previous level has been passed. */
export function levelUnlocked(level: number, state: PersistedState, scenarioLevels: Map<string, number>): boolean {
  if (level <= 1) return true;
  for (const [id, progress] of Object.entries(state.progress)) {
    if (progress.passed && scenarioLevels.get(id) === level - 1) return true;
  }
  return false;
}
