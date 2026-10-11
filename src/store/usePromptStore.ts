import { create } from 'zustand';
import type { SavedPrompt, EvaluationResult, ImprovementResult, AIComparisonAnalysis, AppSettings, PromptCategory, OllamaSettings, OllamaModel } from '@/types';
import { storage, defaultSettings, defaultOllamaSettings } from '@/lib/storage';
import { makeDemoEvaluation, makeDemoImprovement, makeDemoComparisonAnalysis } from '@/lib/demoData';
import { uid } from '@/lib/utils';
import {
  testConnection,
  listModels,
  evaluatePrompt as ollamaEvaluate,
  improvePrompt as ollamaImprove,
  comparePromptsWithAI as ollamaCompare,
  type OllamaError,
} from '@/services/ollamaService';

interface PromptState {
  prompts: SavedPrompt[];
  evaluations: EvaluationResult[];
  improvements: ImprovementResult[];
  settings: AppSettings;
  models: OllamaModel[];
  comparison: {
    original: EvaluationResult | null;
    improved: EvaluationResult | null;
    improvement: ImprovementResult | null;
  };
  ui: {
    commandPaletteOpen: boolean;
    mobileSidebarOpen: boolean;
    toasts: { id: string; type: 'success' | 'error' | 'info'; title: string; description?: string }[];
  };

  hydrate: () => void;

  upsertPrompt: (p: Partial<SavedPrompt> & { title: string; content: string }) => SavedPrompt;
  updatePrompt: (id: string, patch: Partial<SavedPrompt>) => void;
  duplicatePrompt: (id: string) => SavedPrompt | null;
  deletePrompt: (id: string) => void;
  importPrompts: (list: SavedPrompt[]) => number;

  addEvaluation: (r: EvaluationResult) => void;
  deleteEvaluation: (id: string) => void;
  addImprovement: (r: ImprovementResult) => void;
  deleteImprovement: (id: string) => void;

  setComparison: (patch: Partial<PromptState['comparison']>) => void;

  updateSettings: (patch: Partial<AppSettings>) => void;
  updateOllamaSettings: (patch: Partial<OllamaSettings>) => void;
  toggleDemoMode: () => void;
  setSelectedModel: (model: string) => void;

  discoverModels: (baseUrl?: string) => Promise<{ models: OllamaModel[]; error?: OllamaError }>;
  testOllamaConnection: () => Promise<{ ok: boolean; error?: OllamaError }>;

  runEvaluate: (args: {
    title: string;
    content: string;
    promptId?: string;
    preferDemo?: boolean;
  }) => Promise<EvaluationResult>;

  runImprove: (args: {
    title: string;
    content: string;
    promptId?: string;
    preferDemo?: boolean;
  }) => Promise<ImprovementResult>;

  runCompareAnalysis: (args: {
    promptA: { title: string; content: string };
    promptB: { title: string; content: string };
    preferDemo?: boolean;
  }) => Promise<AIComparisonAnalysis>;

  openCommandPalette: () => void;
  closeCommandPalette: () => void;
  toggleCommandPalette: () => void;
  toggleMobileSidebar: (v?: boolean) => void;

  pushToast: (toast: Omit<PromptState['ui']['toasts'][number], 'id'>) => string;
  removeToast: (id: string) => void;

  clearAllData: () => void;
}

function cleanDemoPrompts(list: SavedPrompt[]): SavedPrompt[] {
  return list.filter(
    (p) =>
      !p.id.startsWith('seed-') &&
      !p.id.startsWith('demo-prompt-') &&
      p.title !== 'Weekly Engineering Standup Summary' &&
      p.title !== 'Customer Escalation Response' &&
      p.title !== 'Security Audit Checklist'
  );
}

export const usePromptStore = create<PromptState>((set, get) => ({
  prompts: [],
  evaluations: [],
  improvements: [],
  settings: defaultSettings(),
  models: [],
  comparison: { original: null, improved: null, improvement: null },
  ui: { commandPaletteOpen: false, mobileSidebarOpen: false, toasts: [] },

  hydrate: () => {
    const raw = storage.getPrompts();
    const prompts = cleanDemoPrompts(raw);
    if (prompts.length !== raw.length) {
      storage.savePrompts(prompts);
    }
    const evaluations = storage.getEvaluations();
    const improvements = storage.getImprovements();
    const settings = storage.getSettings();
    const activeImpId = storage.getActiveImprovementId();
    let comparison = { original: null, improved: null, improvement: null } as PromptState['comparison'];
    const activeImp = activeImpId
      ? improvements.find((i) => i.id === activeImpId)
      : improvements[0];
    if (activeImp) {
      const origEval = evaluations.find((e) => e.promptContent === activeImp.originalPromptContent) ?? null;
      const impEval = evaluations.find((e) => e.promptContent === activeImp.improvedPromptContent) ?? null;
      comparison = { original: origEval, improved: impEval, improvement: activeImp };
    }
    set({ prompts, evaluations, improvements, settings, comparison });
  },

  upsertPrompt: (p) => {
    const now = new Date().toISOString();
    const existing = p.id ? get().prompts.find((x) => x.id === p.id) : undefined;
    let saved: SavedPrompt;
    if (existing) {
      saved = { ...existing, ...p, category: p.category ?? existing.category, updatedAt: now };
    } else {
      saved = {
        id: p.id ?? uid('p-'),
        title: p.title,
        content: p.content,
        category: (p.category as PromptCategory) ?? 'General',
        tags: p.tags ?? [],
        notes: p.notes ?? '',
        createdAt: now,
        updatedAt: now,
        lastScore: p.lastScore,
      };
    }
    const next = existing
      ? get().prompts.map((x) => (x.id === saved.id ? saved : x))
      : [saved, ...get().prompts];
    storage.savePrompts(next);
    set({ prompts: next });
    return saved;
  },

  updatePrompt: (id, patch) => {
    const next = get().prompts.map((x) =>
      x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x
    );
    storage.savePrompts(next);
    set({ prompts: next });
  },

  duplicatePrompt: (id) => {
    const src = get().prompts.find((x) => x.id === id);
    if (!src) return null;
    const copy: SavedPrompt = {
      ...src,
      id: uid('p-'),
      title: `${src.title} (Copy)`,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const next = [copy, ...get().prompts];
    storage.savePrompts(next);
    set({ prompts: next });
    return copy;
  },

  deletePrompt: (id) => {
    const next = get().prompts.filter((x) => x.id !== id);
    storage.savePrompts(next);
    set({ prompts: next });
  },

  importPrompts: (list) => {
    const valid = list.filter((p) => p && typeof p.content === 'string' && typeof p.title === 'string');
    const withIds = valid.map((p) => ({ ...p, id: p.id || uid('p-'), createdAt: p.createdAt || new Date().toISOString(), updatedAt: p.updatedAt || new Date().toISOString() }));
    const next = [...withIds, ...get().prompts];
    storage.savePrompts(next);
    set({ prompts: next });
    return withIds.length;
  },

  addEvaluation: (r) => {
    const next = [r, ...get().evaluations].slice(0, 200);
    storage.saveEvaluations(next);
    if (r.promptId) {
      const prompts = get().prompts.map((p) => (p.id === r.promptId ? { ...p, lastScore: r.overallScore, updatedAt: new Date().toISOString() } : p));
      storage.savePrompts(prompts);
      set({ evaluations: next, prompts });
    } else {
      set({ evaluations: next });
    }
  },

  deleteEvaluation: (id) => {
    const next = get().evaluations.filter((e) => e.id !== id);
    storage.saveEvaluations(next);
    set({ evaluations: next });
  },

  addImprovement: (r) => {
    const next = [r, ...get().improvements].slice(0, 200);
    storage.saveImprovements(next);
    set({ improvements: next });
  },

  deleteImprovement: (id) => {
    const next = get().improvements.filter((x) => x.id !== id);
    storage.saveImprovements(next);
    set({ improvements: next });
  },

  setComparison: (patch) => {
    const next = { ...get().comparison, ...patch };
    if (patch.improvement !== undefined) {
      storage.saveActiveImprovementId(patch.improvement?.id ?? null);
    }
    set({ comparison: next });
  },

  updateSettings: (patch) => {
    const next = { ...get().settings, ...patch };
    storage.saveSettings(next);
    set({ settings: next });
  },

  updateOllamaSettings: (patch) => {
    const next = { ...get().settings, ollama: { ...get().settings.ollama, ...patch } };
    storage.saveSettings(next);
    set({ settings: next });
  },

  toggleDemoMode: () => {
    const next = { ...get().settings, demoMode: !get().settings.demoMode };
    storage.saveSettings(next);
    set({ settings: next });
  },

  setSelectedModel: (model) => {
    get().updateOllamaSettings({ selectedModel: model });
  },

  discoverModels: async (baseUrl) => {
    const url = baseUrl ?? get().settings.ollama.baseUrl;
    const prevSelected = get().settings.ollama.selectedModel;
    get().updateOllamaSettings({ connectionStatus: 'checking' });
    try {
      const models = await listModels({ baseUrl: url, timeoutMs: get().settings.ollama.timeoutMs });
      set({ models });
      get().updateOllamaSettings({ connectionStatus: models.length > 0 ? 'connected' : 'disconnected' });
      if (!prevSelected && models.length > 0) {
        get().setSelectedModel(models[0].name);
        get().pushToast({
          type: 'info',
          title: 'Default model selected',
          description: `${models[0].name} will be used for live evaluations. Change it in Settings.`,
        });
      }
      return { models };
    } catch (e: any) {
      get().updateOllamaSettings({ connectionStatus: 'disconnected' });
      return { models: [], error: e };
    }
  },

  testOllamaConnection: async () => {
    get().updateOllamaSettings({ connectionStatus: 'checking' });
    const { ok, error } = await testConnection({
      baseUrl: get().settings.ollama.baseUrl,
      timeoutMs: 10_000,
    });
    get().updateOllamaSettings({ connectionStatus: ok ? 'connected' : 'disconnected' });
    if (ok) get().discoverModels();
    return { ok, error };
  },

  runEvaluate: async ({ title, content, promptId, preferDemo }) => {
    const settings = get().settings;
    const useDemo = preferDemo ?? settings.demoMode;
    if (useDemo) {
      const demo = makeDemoEvaluation(title, content);
      if (promptId) demo.promptId = promptId;
      get().addEvaluation(demo);
      return demo;
    }
    if (!settings.ollama.selectedModel) {
      throw {
        type: 'validation',
        message: 'No Ollama model selected. Go to Settings → Discover Models to select a model for live evaluations.',
        guidance: '1. Open Settings (gear icon in sidebar)\n2. Click "Test Connection" to verify Ollama is running\n3. Click "Discover Models" to see installed models\n4. Click a model to set it as default\n5. Return here and run the evaluation again.\n\nIf Ollama is not installed, download it from ollama.com and run `ollama pull llama3.2` (or another model).',
      };
    }
    const result = await ollamaEvaluate({
      title,
      content,
      model: settings.ollama.selectedModel,
      temperature: settings.ollama.temperature,
      opts: { baseUrl: settings.ollama.baseUrl, timeoutMs: settings.ollama.timeoutMs },
      promptId,
    });
    get().addEvaluation(result);
    return result;
  },

  runImprove: async ({ title, content, promptId, preferDemo }) => {
    const settings = get().settings;
    const useDemo = preferDemo ?? settings.demoMode;
    if (useDemo) {
      const demo = makeDemoImprovement(title, content);
      if (promptId) demo.promptId = promptId;
      get().addImprovement(demo);
      return demo;
    }
    if (!settings.ollama.selectedModel) {
      throw {
        type: 'validation',
        message: 'No Ollama model selected. Go to Settings → Discover Models to select a model before running improvements.',
        guidance: '1. Open Settings (gear icon in sidebar)\n2. Click "Test Connection" to verify Ollama is running\n3. Click "Discover Models" to see installed models\n4. Click a model to set it as default\n5. Return here and run the improvement again.\n\nIf Ollama is not installed, download it from ollama.com and run `ollama pull llama3.2` (or another model).',
      };
    }
    const result = await ollamaImprove({
      title,
      content,
      model: settings.ollama.selectedModel,
      temperature: settings.ollama.temperature,
      opts: { baseUrl: settings.ollama.baseUrl, timeoutMs: settings.ollama.timeoutMs },
      promptId,
    });
    get().addImprovement(result);
    return result;
  },

  runCompareAnalysis: async ({ promptA, promptB, preferDemo }) => {
    const settings = get().settings;
    const useDemo = preferDemo ?? settings.demoMode;
    if (useDemo) {
      return makeDemoComparisonAnalysis(promptA, promptB);
    }
    if (!settings.ollama.selectedModel) {
      throw {
        type: 'validation',
        message: 'No Ollama model selected. Go to Settings → Discover Models to select a model before running AI prompt comparison.',
        guidance: '1. Open Settings (gear icon in sidebar)\n2. Select an installed model\n3. Or enable Demo Mode in the top bar to run comparisons immediately.',
      };
    }
    return await ollamaCompare({
      promptA,
      promptB,
      model: settings.ollama.selectedModel,
      temperature: settings.ollama.temperature,
      opts: { baseUrl: settings.ollama.baseUrl, timeoutMs: settings.ollama.timeoutMs },
    });
  },

  openCommandPalette: () => set({ ui: { ...get().ui, commandPaletteOpen: true } }),
  closeCommandPalette: () => set({ ui: { ...get().ui, commandPaletteOpen: false } }),
  toggleCommandPalette: () => set({ ui: { ...get().ui, commandPaletteOpen: !get().ui.commandPaletteOpen } }),
  toggleMobileSidebar: (v) =>
    set({ ui: { ...get().ui, mobileSidebarOpen: typeof v === 'boolean' ? v : !get().ui.mobileSidebarOpen } }),

  pushToast: (toast) => {
    const id = uid('t-');
    const entry = { id, ...toast };
    set({ ui: { ...get().ui, toasts: [...get().ui.toasts, entry] } });
    setTimeout(() => get().removeToast(id), 4500);
    return id;
  },

  removeToast: (id) => {
    set({ ui: { ...get().ui, toasts: get().ui.toasts.filter((t) => t.id !== id) } });
  },

  clearAllData: () => {
    storage.clearAll();
    set({
      prompts: [],
      evaluations: [],
      improvements: [],
      settings: defaultSettings(),
      models: [],
      comparison: { original: null, improved: null, improvement: null },
    });
  },
}));
