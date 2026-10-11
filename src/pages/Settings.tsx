import React, { useEffect, useState } from 'react';
import {
  Settings as SettingsIcon,
  Server,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  RefreshCw,
  Trash2,
  Download,
  Upload,
  Cpu,
  Database,
  Sparkles,
  Shield,
  Gauge,
  Save,
  XCircle,
  HelpCircle,
  Copy,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import { usePromptStore } from '@/store/usePromptStore';
import { storage, defaultOllamaSettings } from '@/lib/storage';
import { cn, formatBytes, downloadAsFile, copyToClipboard } from '@/lib/utils';
import type { OllamaError } from '@/services/ollamaService';

export default function Settings() {
  const settings = usePromptStore((s) => s.settings);
  const updateSettings = usePromptStore((s) => s.updateSettings);
  const updateOllama = usePromptStore((s) => s.updateOllamaSettings);
  const testConnection = usePromptStore((s) => s.testOllamaConnection);
  const discoverModels = usePromptStore((s) => s.discoverModels);
  const models = usePromptStore((s) => s.models);
  const toggleDemo = usePromptStore((s) => s.toggleDemoMode);
  const clearAll = usePromptStore((s) => s.clearAllData);
  const hydrate = usePromptStore((s) => s.hydrate);
  const pushToast = usePromptStore((s) => s.pushToast);
  const setSelectedModel = usePromptStore((s) => s.setSelectedModel);

  const [baseUrl, setBaseUrl] = useState(settings.ollama.baseUrl);
  const [timeoutMs, setTimeoutMs] = useState(settings.ollama.timeoutMs);
  const [temperature, setTemperature] = useState(settings.ollama.temperature);
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [lastResult, setLastResult] = useState<{ ok: boolean; message: string; guidance?: string } | null>(null);

  const stats = useLocalStats();

  useEffect(() => {
    setBaseUrl(settings.ollama.baseUrl);
    setTimeoutMs(settings.ollama.timeoutMs);
    setTemperature(settings.ollama.temperature);
  }, [settings.ollama.baseUrl, settings.ollama.timeoutMs, settings.ollama.temperature]);

  function saveOllama() {
    updateOllama({
      baseUrl: baseUrl.replace(/\/+$/, '') || defaultOllamaSettings().baseUrl,
      timeoutMs: Math.max(5000, Math.min(300_000, Number(timeoutMs) || 60_000)),
      temperature: Math.max(0, Math.min(1.5, Number(temperature) || 0.3)),
    });
    pushToast({ type: 'success', title: 'Settings saved' });
  }

  async function handleTest() {
    saveOllama();
    setTesting(true);
    setLastResult(null);
    const { ok, error } = await testConnection();
    setTesting(false);
    setLastResult(
      ok
        ? { ok: true, message: 'Successfully connected to Ollama.' }
        : {
            ok: false,
            message: error?.message ?? 'Connection failed.',
            guidance: error?.guidance,
          }
    );
    pushToast({
      type: ok ? 'success' : 'error',
      title: ok ? 'Ollama connected' : 'Connection failed',
      description: ok ? baseUrl : error?.message,
    });
  }

  async function handleDiscover() {
    setDiscovering(true);
    setLastResult(null);
    const { error } = await discoverModels();
    setDiscovering(false);
    if (error) {
      setLastResult({ ok: false, message: error.message, guidance: error.guidance });
      pushToast({ type: 'error', title: 'Model discovery failed', description: error.message });
    } else {
      pushToast({ type: 'success', title: 'Models refreshed', description: `${models.length} discovered` });
    }
  }

  function exportAll() {
    const blob = storage.exportAll();
    downloadAsFile(
      `promptiQ-backup-${new Date().toISOString().slice(0, 10)}.json`,
      blob,
      'application/json'
    );
    pushToast({ type: 'success', title: 'Backup exported' });
  }

  function onImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result));
        if (!parsed || typeof parsed !== 'object') throw new Error('Invalid backup format.');
        let any = false;
        if (Array.isArray(parsed.prompts)) {
          storage.savePrompts(parsed.prompts);
          any = true;
        }
        if (Array.isArray(parsed.evaluations)) {
          storage.saveEvaluations(parsed.evaluations);
          any = true;
        }
        if (Array.isArray(parsed.improvements)) {
          storage.saveImprovements(parsed.improvements);
          any = true;
        }
        if (parsed.settings && typeof parsed.settings === 'object') {
          storage.saveSettings(parsed.settings);
          any = true;
        }
        if (!any) throw new Error('No recognised PromptIQ data found in file.');
        hydrate();
        pushToast({ type: 'success', title: 'Backup restored' });
      } catch (err: any) {
        pushToast({ type: 'error', title: 'Restore failed', description: err?.message ?? 'Unknown error' });
      } finally {
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  }

  function handleClearAll() {
    if (
      !confirm(
        'Delete ALL saved PromptIQ data from this browser? This removes prompts, evaluations, improvements, and settings. It cannot be undone.'
      )
    )
      return;
    clearAll();
    pushToast({ type: 'info', title: 'All local data cleared' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Settings"
        title="Ollama, Demo Mode, and data."
        subtitle="Configure your Ollama connection, toggle demo mode, and manage the data stored in your browser."
        actions={
          <button onClick={saveOllama} className="btn-primary">
            <Save className="h-4 w-4" /> Save Changes
          </button>
        }
      />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <div className="card p-6 space-y-5">
            <SectionHeader
              icon={<Server className="h-5 w-5" />}
              title="Ollama Server"
              subtitle="Connect to your local Ollama instance to run live evaluations and improvements."
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2 space-y-1.5">
                <label className="label">Server URL</label>
                <input
                  className="input h-11 font-mono text-[13px]"
                  placeholder="http://localhost:11434"
                  value={baseUrl}
                  onChange={(e) => setBaseUrl(e.target.value)}
                />
                <p className="text-[11px] text-muted">
                  Default is <code className="bg-border-light border border-border rounded px-1">http://localhost:11434</code>.
                </p>
              </div>
              <div className="space-y-1.5">
                <label className="label">Status</label>
                <ConnectionBadge status={settings.ollama.connectionStatus} />
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="label !mb-0">
                    <span className="inline-flex items-center gap-1.5">
                      <Gauge className="h-3.5 w-3.5 text-muted" /> Request Timeout
                    </span>
                  </label>
                  <span className="text-xs font-mono text-muted tabular-nums">{timeoutMs} ms</span>
                </div>
                <input
                  type="range"
                  min={5000}
                  max={180_000}
                  step={1000}
                  value={timeoutMs}
                  onChange={(e) => setTimeoutMs(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[10px] text-muted uppercase tracking-wider">
                  <span>5s</span>
                  <span>180s</span>
                </div>
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="label !mb-0">
                    <span className="inline-flex items-center gap-1.5">
                      <Cpu className="h-3.5 w-3.5 text-muted" /> Temperature
                    </span>
                  </label>
                  <span className="text-xs font-mono text-muted tabular-nums">{temperature.toFixed(2)}</span>
                </div>
                <input
                  type="range"
                  min={0}
                  max={1.2}
                  step={0.05}
                  value={temperature}
                  onChange={(e) => setTemperature(Number(e.target.value))}
                  className="w-full accent-accent"
                />
                <div className="flex justify-between text-[10px] text-muted uppercase tracking-wider">
                  <span>Deterministic</span>
                  <span>Creative</span>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-border">
              <button
                className="btn-secondary"
                onClick={handleTest}
                disabled={testing}
              >
                {testing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {testing ? 'Testing…' : 'Test Connection'}
              </button>
              <button
                className="btn-secondary"
                onClick={handleDiscover}
                disabled={discovering}
              >
                {discovering ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
                {discovering ? 'Discovering…' : 'Discover Models'}
              </button>
              <button className="btn-ghost" onClick={saveOllama}>
                Save server settings
              </button>
            </div>

            {lastResult && (
              <div
                className={cn(
                  'p-4 rounded-lg border flex items-start gap-3 text-sm',
                  lastResult.ok
                    ? 'border-score-excellent/20 bg-score-excellent/5'
                    : 'border-score-poor/20 bg-score-poor/5'
                )}
              >
                {lastResult.ok ? (
                  <CheckCircle2 className="h-5 w-5 text-score-excellent shrink-0 mt-0.5" />
                ) : (
                  <AlertTriangle className="h-5 w-5 text-score-poor shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-ink">
                    {lastResult.ok ? 'Connection Successful' : 'Connection Unsuccessful'}
                  </div>
                  <div className="mt-0.5 text-ink/80 leading-relaxed">{lastResult.message}</div>
                  {lastResult.guidance && (
                    <div className="mt-2 text-xs text-muted whitespace-pre-line leading-relaxed border-t border-border/60 pt-2">
                      {lastResult.guidance}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="card p-6 space-y-5">
            <SectionHeader
              icon={<Database className="h-5 w-5" />}
              title={`Available Models (${models.length})`}
              subtitle="Pick a default model for evaluations and improvements."
              action={
                <button onClick={handleDiscover} className="btn-ghost text-xs" disabled={discovering}>
                  <RefreshCw className={cn('h-3.5 w-3.5', discovering && 'animate-spin')} /> Refresh
                </button>
              }
            />
            {models.length === 0 ? (
              <div className="border border-dashed border-border rounded-lg p-6 space-y-4 text-sm">
                <div className="text-center">
                  <div className="text-ink font-medium">No models discovered yet</div>
                  <p className="text-muted mt-1 max-w-sm mx-auto leading-relaxed">
                    Click <span className="font-medium">Discover Models</span> above to list installed models, or install one using the command below.
                  </p>
                </div>
                <div className="max-w-md mx-auto border border-border rounded-md overflow-hidden">
                  <div className="flex items-center gap-2 px-3 py-2 bg-border-light/60 border-b border-border">
                    <Cpu className="h-3.5 w-3.5 text-muted" />
                    <span className="text-[11px] font-semibold uppercase tracking-wider text-muted">Recommended</span>
                  </div>
                  <div className="flex items-center gap-2 px-3 py-2.5 bg-white">
                    <code className="font-mono text-[13px] text-ink flex-1">ollama pull llama3.2</code>
                    <button
                      className="btn-ghost !p-1.5 h-7 w-7 shrink-0"
                      onClick={async () => {
                        const ok = await copyToClipboard('ollama pull llama3.2');
                        pushToast({ type: ok ? 'success' : 'error', title: ok ? 'Copied' : 'Copy failed' });
                      }}
                      title="Copy command"
                      aria-label="Copy command"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
                <p className="text-[11px] text-muted text-center max-w-md mx-auto leading-relaxed">
                  Run this in a terminal, then return here and click <span className="font-medium">Discover Models</span>.
                  Any of <code className="bg-border-light rounded px-1">llama3.2</code>, <code className="bg-border-light rounded px-1">mistral</code>, or <code className="bg-border-light rounded px-1">gemma2</code> work well for prompt evaluation.
                </p>
              </div>
            ) : (
              <ul className="rounded-lg border border-border overflow-hidden divide-y divide-border-light">
                {models.map((m) => {
                  const active = settings.ollama.selectedModel === m.name;
                  return (
                    <li key={m.name}>
                      <button
                        onClick={() => {
                          setSelectedModel(m.name);
                          pushToast({ type: 'info', title: 'Default model updated', description: m.name });
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-border-light/50',
                          active && 'bg-accent/[0.04]'
                        )}
                      >
                        <div
                          className={cn(
                            'h-9 w-9 rounded-md flex items-center justify-center shrink-0 ring-1',
                            active
                              ? 'bg-accent/10 text-accent ring-accent/20'
                              : 'bg-border-light text-muted ring-border'
                          )}
                        >
                          <Cpu className="h-4 w-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-medium text-ink truncate">{m.name}</span>
                            {active && (
                              <span className="chip-accent !py-0 !px-1.5 !h-5 !text-[10px]">Default</span>
                            )}
                          </div>
                          <div className="mt-0.5 text-[11px] text-muted flex items-center gap-2 flex-wrap">
                            {m.details?.parameterSize && <span>{m.details.parameterSize}</span>}
                            {m.details?.quantizationLevel && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-muted/60" />
                                {m.details.quantizationLevel}
                              </span>
                            )}
                            {m.details?.family && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-muted/60" />
                                {m.details.family}
                              </span>
                            )}
                            {m.size > 0 && (
                              <span className="inline-flex items-center gap-1">
                                <span className="h-1 w-1 rounded-full bg-muted/60" />
                                {formatBytes(m.size)}
                              </span>
                            )}
                          </div>
                        </div>
                        {active ? (
                          <CheckCircle2 className="h-5 w-5 text-accent shrink-0" />
                        ) : (
                          <span className="text-xs text-muted shrink-0">Use default →</span>
                        )}
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </section>

        <div className="space-y-6">
          <div className="card p-6 space-y-4">
            <SectionHeader
              icon={<Sparkles className="h-5 w-5" />}
              title="Demo Mode"
              subtitle="Use deterministic sample results to demonstrate the product without a running Ollama instance."
            />
            <div className="flex items-center justify-between p-4 rounded-lg border border-border bg-border-light/40">
              <div>
                <div className="text-sm font-semibold text-ink">Use demo samples</div>
                <div className="text-xs text-muted mt-0.5 leading-relaxed">
                  {settings.demoMode
                    ? 'All AI calls return curated sample results.'
                    : 'Live AI will run against the Ollama model you select.'}
                </div>
              </div>
              <ToggleSwitch on={settings.demoMode} onChange={toggleDemo} />
            </div>
            <div className="flex items-start gap-2 p-3 rounded-md border border-accent/20 bg-accent/5 text-xs">
              <HelpCircle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
              <div className="leading-relaxed text-ink/85">
                Demo mode is clearly labeled throughout the interface so users can tell sample results apart from live AI.
              </div>
            </div>
          </div>

          <div className="card p-6 space-y-4">
            <SectionHeader
              icon={<Shield className="h-5 w-5" />}
              title="Local Data"
              subtitle="Everything you create is stored locally in your browser."
            />
            <dl className="space-y-2.5 text-sm">
              <StatRow label="Saved Prompts" value={stats.prompts} />
              <StatRow label="Evaluations" value={stats.evaluations} />
              <StatRow label="Improvements" value={stats.improvements} />
              <StatRow label="Total Size" value={formatBytes(stats.bytes)} />
            </dl>
            <div className="pt-3 border-t border-border space-y-2">
              <div className="flex items-center gap-2">
                <button className="btn-secondary flex-1" onClick={exportAll}>
                  <Download className="h-4 w-4" /> Export Backup
                </button>
                <label className="btn-secondary cursor-pointer flex-1 inline-flex justify-center">
                  <Upload className="h-4 w-4" /> Restore Backup
                  <input type="file" accept="application/json" className="hidden" onChange={onImportFile} />
                </label>
              </div>
              <button className="btn-danger w-full" onClick={handleClearAll}>
                <Trash2 className="h-4 w-4" /> Clear All Data
              </button>
            </div>
          </div>

          <div className="card p-6 space-y-3 text-xs text-muted leading-relaxed">
            <div className="flex items-center gap-2 text-ink font-semibold">
              <SettingsIcon className="h-4 w-4" /> Version & About
            </div>
            <p>
              <span className="font-semibold text-ink">PromptIQ Enterprise 2.0</span> · Frontend-only workspace built with
              React, Vite, TypeScript, Tailwind, Zustand, and Lucide.
            </p>
            <p>
              Data never leaves your device. Connect Ollama for live prompt evaluation and improvement, or use Demo Mode
              to see the full experience without a model running.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionHeader({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3 min-w-0">
        <div className="h-10 w-10 rounded-lg bg-accent/5 text-accent ring-1 ring-accent/20 flex items-center justify-center shrink-0">
          {icon}
        </div>
        <div className="min-w-0">
          <h2 className="heading-md">{title}</h2>
          {subtitle && <p className="mt-1 text-sm text-muted leading-relaxed max-w-2xl">{subtitle}</p>}
        </div>
      </div>
      {action}
    </div>
  );
}

function ConnectionBadge({ status }: { status: 'unknown' | 'connected' | 'disconnected' | 'checking' }) {
  const map = {
    unknown: {
      label: 'Unknown',
      icon: AlertTriangle,
      cls: 'border-border bg-border-light text-muted',
    },
    checking: {
      label: 'Checking',
      icon: Loader2,
      cls: 'border-score-fair/20 bg-score-fair/5 text-score-fair',
    },
    connected: {
      label: 'Connected',
      icon: CheckCircle2,
      cls: 'border-score-excellent/20 bg-score-excellent/5 text-score-excellent',
    },
    disconnected: {
      label: 'Disconnected',
      icon: XCircle,
      cls: 'border-score-poor/20 bg-score-poor/5 text-score-poor',
    },
  }[status];
  const Icon = map.icon;
  return (
    <div className={cn('h-11 inline-flex items-center gap-2 px-3 rounded-md border font-medium text-sm', map.cls)}>
      <Icon className={cn('h-4 w-4', status === 'checking' && 'animate-spin')} />
      {map.label}
    </div>
  );
}

function ToggleSwitch({ on, onChange }: { on: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      role="switch"
      aria-checked={on}
      className={cn(
        'relative h-6 w-11 rounded-full transition-colors border focus:outline-none focus:ring-2 focus:ring-accent/40',
        on ? 'bg-accent border-accent' : 'bg-border border-border'
      )}
    >
      <span
        className={cn(
          'absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all',
          on ? 'left-[22px]' : 'left-0.5'
        )}
      />
    </button>
  );
}

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <dt className="text-muted">{label}</dt>
      <dd className="font-semibold text-ink tabular-nums">{value}</dd>
    </div>
  );
}

function useLocalStats() {
  const [tick, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((x) => x + 1), 2500);
    return () => clearInterval(t);
  }, []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const _ = tick;
  return {
    prompts: storage.getPrompts().length,
    evaluations: storage.getEvaluations().length,
    improvements: storage.getImprovements().length,
    bytes: storage.sizeBytes(),
  };
}
