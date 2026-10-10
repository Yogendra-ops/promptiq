import type {
  SavedPrompt,
  EvaluationResult,
  ImprovementResult,
  AppSettings,
  OllamaSettings,
} from '@/types';

const KEYS = {
  prompts: 'promptiQ.prompts.v1',
  evaluations: 'promptiQ.evaluations.v1',
  improvements: 'promptiQ.improvements.v1',
  settings: 'promptiQ.settings.v1',
  labState: 'promptiQ.labState.v1',
} as const;

function safeRead<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T): boolean {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

export const storage = {
  getPrompts(): SavedPrompt[] {
    return safeRead<SavedPrompt[]>(KEYS.prompts, []);
  },
  savePrompts(prompts: SavedPrompt[]) {
    return safeWrite(KEYS.prompts, prompts);
  },

  getEvaluations(): EvaluationResult[] {
    return safeRead<EvaluationResult[]>(KEYS.evaluations, []);
  },
  saveEvaluations(items: EvaluationResult[]) {
    return safeWrite(KEYS.evaluations, items);
  },

  getImprovements(): ImprovementResult[] {
    return safeRead<ImprovementResult[]>(KEYS.improvements, []);
  },
  saveImprovements(items: ImprovementResult[]) {
    return safeWrite(KEYS.improvements, items);
  },

  getSettings(): AppSettings {
    return safeRead<AppSettings>(KEYS.settings, defaultSettings());
  },
  saveSettings(settings: AppSettings) {
    return safeWrite(KEYS.settings, settings);
  },

  getLabState(): { title: string; content: string } | null {
    return safeRead<{ title: string; content: string } | null>(KEYS.labState, null);
  },
  saveLabState(state: { title: string; content: string }) {
    return safeWrite(KEYS.labState, state);
  },

  clearAll() {
    Object.values(KEYS).forEach((k) => localStorage.removeItem(k));
  },

  clearEvaluationsAndImprovements() {
    localStorage.removeItem(KEYS.evaluations);
    localStorage.removeItem(KEYS.improvements);
  },

  exportAll(): string {
    const out: Record<string, any> = {};
    Object.entries(KEYS).forEach(([k, key]) => {
      const raw = localStorage.getItem(key);
      if (raw) {
        try {
          out[k] = JSON.parse(raw);
        } catch {
          out[k] = raw;
        }
      }
    });
    return JSON.stringify(out, null, 2);
  },

  sizeBytes(): number {
    let total = 0;
    Object.values(KEYS).forEach((k) => {
      const raw = localStorage.getItem(k);
      if (raw) total += raw.length * 2;
    });
    return total;
  },
};

export function defaultOllamaSettings(): OllamaSettings {
  return {
    baseUrl: 'http://localhost:11434',
    selectedModel: '',
    connectionStatus: 'unknown',
    timeoutMs: 60_000,
    temperature: 0.3,
  };
}

export function defaultSettings(): AppSettings {
  return {
    ollama: defaultOllamaSettings(),
    demoMode: false,
    lastOpenedPage: 'overview',
  };
}
