import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Clock, TrendingUp, Scale, LibraryBig, FlaskConical, Mail, FileText, Database, BookOpen, BarChart3, Calendar, Sparkles, CheckCircle2, Loader2, AlertTriangle, Cpu, Copy, Circle } from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import PromptEditor from '@/components/ui/PromptEditor';
import { OverallScoreBadge } from '@/components/ui/ScoreMeter';
import { usePromptStore } from '@/store/usePromptStore';
import { DEMO_TEMPLATES } from '@/lib/demoData';
import { formatRelativeTime, scoreLabel, cn, scoreToColor, copyToClipboard } from '@/lib/utils';
import type { OllamaModel } from '@/types';

export default function Overview() {
  const navigate = useNavigate();
  const evaluations = usePromptStore((s) => s.evaluations).slice(0, 8);
  const prompts = usePromptStore((s) => s.prompts);
  const improvements = usePromptStore((s) => s.improvements);
  const setComparison = usePromptStore((s) => s.setComparison);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const connectionStatus = usePromptStore((s) => s.settings.ollama.connectionStatus);
  const selectedModel = usePromptStore((s) => s.settings.ollama.selectedModel);
  const models = usePromptStore((s) => s.models);
  const testOllamaConnection = usePromptStore((s) => s.testOllamaConnection);
  const discoverModels = usePromptStore((s) => s.discoverModels);
  const setSelectedModel = usePromptStore((s) => s.setSelectedModel);
  const toggleDemo = usePromptStore((s) => s.toggleDemoMode);
  const pushToast = usePromptStore((s) => s.pushToast);
  const totalRuns = evaluations.length + improvements.length;
  const setupIncomplete = !demoMode && (connectionStatus !== 'connected' || models.length === 0 || !selectedModel);
  const needsSetup = totalRuns === 0 && (setupIncomplete || demoMode);

  const avgScore =
    evaluations.length > 0
      ? evaluations.reduce((a, e) => a + e.overallScore, 0) / evaluations.length
      : 0;

  const quickTemplates = DEMO_TEMPLATES.slice(0, 4);
  const templateIcons: Record<string, any> = {
    Mail,
    FileText,
    Calendar,
    BarChart3,
    Database,
    BookOpen,
  };

interface SetupChecklistProps {
  demoMode: boolean;
  connectionStatus: 'unknown' | 'connected' | 'disconnected' | 'checking';
  selectedModel: string;
  models: OllamaModel[];
  onTestConnection: () => Promise<void> | void;
  onDiscover: () => Promise<void> | void;
  onSelectModel: (name: string) => void;
  onToggleDemo: () => void;
  onGoLab: () => void;
}

function SetupChecklist(props: SetupChecklistProps) {
  const {
    demoMode,
    connectionStatus,
    selectedModel,
    models,
    onTestConnection,
    onDiscover,
    onSelectModel,
    onToggleDemo,
    onGoLab,
  } = props;
  const [testing, setTesting] = useState(false);
  const [discovering, setDiscovering] = useState(false);

  const step1Done = connectionStatus !== 'disconnected';
  const step2Done = connectionStatus === 'connected';
  const step3Done = models.length > 0;
  const step4Done = !!selectedModel;

  const allDone = step1Done && step2Done && step3Done && step4Done;

  const steps: Array<{
    n: number;
    title: string;
    body: string;
    done: boolean;
    active: boolean;
    node: React.ReactNode;
  }> = [
    {
      n: 1,
      title: 'Start Ollama locally',
      body: 'Ollama runs a small HTTP server on your machine. Open a terminal and run ollama serve, or launch the Ollama desktop app.',
      done: step1Done,
      active: true,
      node: (
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs">
            <span className="chip !py-0 !h-5 !text-[11px] font-mono">ollama serve</span>
            <span className="text-muted">or open the Ollama app</span>
          </div>
          <div className="text-[11px] text-muted leading-relaxed">
            Download from{' '}
            <a className="text-accent underline" href="https://ollama.com/" target="_blank" rel="noreferrer">
              ollama.com
            </a>{' '}
            if it isn't installed yet.
          </div>
        </div>
      ),
    },
    {
      n: 2,
      title: 'Test the connection',
      body: 'Verify PromptIQ can reach your local Ollama instance at the configured URL.',
      done: step2Done,
      active: step1Done,
      node: (
        <button
          className="btn-secondary"
          onClick={async () => {
            setTesting(true);
            try {
              await onTestConnection();
            } finally {
              setTimeout(() => setTesting(false), 200);
            }
          }}
          disabled={testing || connectionStatus === 'checking'}
        >
          {(testing || connectionStatus === 'checking') ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : connectionStatus === 'connected' ? (
            <CheckCircle2 className="h-4 w-4 text-score-excellent" />
          ) : (
            <Cpu className="h-4 w-4" />
          )}
          {connectionStatus === 'connected' ? 'Connection verified' : testing ? 'Testing…' : 'Test connection'}
        </button>
      ),
    },
    {
      n: 3,
      title: 'Install a model',
      body: models.length === 0
        ? 'Pull at least one model. We recommend Llama 3.2 for prompt evaluation — it balances quality and speed.'
        : `Found ${models.length} installed model${models.length === 1 ? '' : 's'}.`,
      done: step3Done,
      active: step2Done,
      node: step3Done ? null : (
        <div className="space-y-3 w-full">
          <div className="flex items-center gap-2 border border-border rounded-md p-2 bg-white max-w-md">
            <code className="font-mono text-[13px] text-ink flex-1 px-1">ollama pull llama3.2</code>
            <button
              className="btn-ghost !p-1.5 h-7 w-7 shrink-0"
              onClick={async () => {
                const ok = await copyToClipboard('ollama pull llama3.2');
                if (ok) console.log('ok');
              }}
              title="Copy command"
            >
              <Copy className="h-3.5 w-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <button
              className="btn-secondary"
              onClick={async () => {
                setDiscovering(true);
                try {
                  await onDiscover();
                } finally {
                  setTimeout(() => setDiscovering(false), 200);
                }
              }}
              disabled={discovering}
            >
              {discovering ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Database className="h-4 w-4" />
              )}
              {discovering ? 'Scanning…' : 'I pulled a model — scan now'}
            </button>
            <span className="text-[11px] text-muted">
              Try also: mistral, gemma2, qwen2.5
            </span>
          </div>
        </div>
      ),
    },
    {
      n: 4,
      title: 'Select a default model',
      body: 'Pick which installed model PromptIQ uses for evaluations and improvements.',
      done: step4Done,
      active: step3Done,
      node: models.length === 0 ? (
        <div className="text-xs text-muted">Complete step 3 first.</div>
      ) : (
        <div className="flex items-center gap-2 flex-wrap">
          <select
            className="input h-10 max-w-xs font-medium"
            value={selectedModel}
            onChange={(e) => onSelectModel(e.target.value)}
          >
            <option value="">Pick a model…</option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {m.name}
                {m.details?.parameterSize ? ` · ${m.details.parameterSize}` : ''}
              </option>
            ))}
          </select>
          {selectedModel && (
            <span className="chip-accent !h-6 !text-[11px]">
              <CheckCircle2 className="h-3 w-3" /> Using {selectedModel.split(':')[0]}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="card p-8 border-accent/20">
      <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6 mb-6">
        <div className="flex items-start gap-3 min-w-0">
          <div className="h-11 w-11 rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20 flex items-center justify-center shrink-0">
            <Cpu className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <div className="section-title mb-1.5">{demoMode ? 'Welcome — use your own model' : 'One-time setup'}</div>
            <h2 className="heading-lg">
              {demoMode ? 'Switch to your local Ollama to use gemma4:e2b' : 'Connect your local Ollama instance'}
            </h2>
            <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
              {demoMode
                ? 'You\'re currently viewing sample results. Turn off Demo Mode below and follow the 4 steps to evaluate prompts live against your local gemma4:e2b model — nothing is sent to the cloud.'
                : 'PromptIQ evaluates prompts entirely on your device — nothing is sent to a cloud AI. Follow these 4 steps to connect your running Ollama server and start evaluating live.'}
            </p>
          </div>
        </div>
        {demoMode ? (
          <button
            className="btn-primary shrink-0"
            onClick={onToggleDemo}
          >
            <Cpu className="h-4 w-4" />
            Turn off Demo Mode · use live model
          </button>
        ) : (
          <button className="btn-ghost shrink-0" onClick={onToggleDemo}>
            <Sparkles className="h-4 w-4 text-accent" />
            Skip setup · Try Demo Mode
          </button>
        )}
      </div>

      {allDone ? (
        <div className="rounded-lg border border-score-excellent/20 bg-score-excellent/5 p-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-start gap-3 min-w-0">
            <div className="h-10 w-10 rounded-md bg-score-excellent/15 text-score-excellent flex items-center justify-center shrink-0">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="heading-md text-ink">You're all set — start prompting!</div>
              <p className="mt-1 text-sm text-ink/75 leading-relaxed">
                Connected to Ollama, using <span className="font-semibold text-ink">{selectedModel.split(':')[0]}</span> for live evaluations.
              </p>
            </div>
          </div>
          <button className="btn-primary shrink-0" onClick={onGoLab}>
            <FlaskConical className="h-4 w-4" />
            Open Prompt Lab <ArrowRight className="h-4 w-4 -mr-1" />
          </button>
        </div>
      ) : (
        <ol className="space-y-4">
          {steps.map((step) => (
            <li
              key={step.n}
              className={cn(
                'border rounded-lg p-5 transition-all',
                step.done
                  ? 'border-score-excellent/20 bg-score-excellent/[0.03]'
                  : step.active
                    ? 'border-border bg-white'
                    : 'border-border/60 bg-border-light/30 opacity-70'
              )}
            >
              <div className="flex items-start gap-4">
                <div className="shrink-0">
                  {step.done ? (
                    <div className="h-8 w-8 rounded-full bg-score-excellent/15 text-score-excellent flex items-center justify-center">
                      <CheckCircle2 className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                    </div>
                  ) : step.active ? (
                    <div className="h-8 w-8 rounded-full ring-1 ring-border bg-white text-ink font-semibold text-xs flex items-center justify-center">
                      {step.n}
                    </div>
                  ) : (
                    <div className="h-8 w-8 rounded-full ring-1 ring-border bg-border-light text-muted font-semibold text-xs flex items-center justify-center">
                      <Circle className="h-3.5 w-3.5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0 space-y-3">
                  <div>
                    <div className={cn(
                      'text-sm font-semibold',
                      step.done ? 'text-ink' : step.active ? 'text-ink' : 'text-muted'
                    )}>
                      Step {step.n} · {step.title}
                    </div>
                    <p className="mt-1 text-sm text-muted leading-relaxed max-w-2xl">{step.body}</p>
                  </div>
                  {step.active && step.node}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}

      <div className="mt-6 flex items-start gap-2 p-3 rounded-md border border-accent/20 bg-accent/5 text-xs leading-relaxed">
        <AlertTriangle className="h-4 w-4 text-accent shrink-0 mt-0.5" />
        <div className="text-ink/85">
          <span className="font-semibold text-accent">Heads up:</span> Your browser may block HTTP access to <code className="bg-white border border-border rounded px-1">localhost:11434</code> if
          you're viewing this page over HTTPS. If step 2 fails despite Ollama running, run the app locally with <code className="bg-white border border-border rounded px-1">npm run dev</code> over plain HTTP.
        </div>
      </div>
    </div>
  );
}

  async function handleQuickStart(templateId: string) {
    const tpl = DEMO_TEMPLATES.find((t) => t.id === templateId);
    if (!tpl) return;
    const filled = tpl.content.replace(/\{\{(\w+)\}\}/g, (m, name) => {
      const v = tpl.variables.find((x) => x.name === name);
      return v?.defaultValue || `[${v?.label || name}]`;
    });
    const saved = upsertPrompt({
      title: `${tpl.name} Prompt`,
      content: filled,
      category: tpl.category,
      tags: ['template', tpl.name.toLowerCase().replace(/\s+/g, '-')],
    });
    navigate(`/lab?prompt=${saved.id}`);
  }

  function draftFromSample(title: string, content: string) {
    const saved = upsertPrompt({
      title,
      content,
      category: 'General',
      tags: ['sample'],
    });
    navigate(`/evaluator`);
  }

  const stats = [
    {
      label: 'Saved Prompts',
      value: prompts.length,
      icon: LibraryBig,
      hint: 'Local library',
      accent: 'text-accent',
      ring: 'ring-accent/20 bg-accent/5',
    },
    {
      label: 'Evaluations Run',
      value: evaluations.length,
      icon: Scale,
      hint: 'All time',
      accent: 'text-score-excellent',
      ring: 'ring-score-excellent/20 bg-score-excellent/5',
    },
    {
      label: 'Improvements',
      value: improvements.length,
      icon: Sparkles,
      hint: 'Rewrites produced',
      accent: 'text-score-fair',
      ring: 'ring-score-fair/20 bg-score-fair/5',
    },
    {
      label: 'Average Score',
      value: avgScore ? `${avgScore.toFixed(1)}` : '—',
      icon: TrendingUp,
      hint: evaluations.length ? `Across ${evaluations.length} runs` : 'Run an evaluation',
      accent: avgScore >= 7 ? 'text-score-excellent' : avgScore >= 5 ? 'text-score-fair' : 'text-muted',
      ring:
        avgScore >= 7
          ? 'ring-score-excellent/20 bg-score-excellent/5'
          : avgScore >= 5
          ? 'ring-score-fair/20 bg-score-fair/5'
          : 'ring-border bg-border-light',
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Welcome back"
        title="Make every prompt count."
        subtitle="Draft, evaluate, improve, compare, and reuse AI prompts — all in one workspace. Your data stays local in your browser."
        actions={
          <>
            <button className="btn-secondary" onClick={() => navigate('/templates')}>
              <LibraryBig className="h-4 w-4" />
              Browse Templates
            </button>
            <button className="btn-primary" onClick={() => navigate('/lab')}>
              <FlaskConical className="h-4 w-4" />
              Open Prompt Lab
            </button>
          </>
        }
      />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="card p-5">
              <div className="flex items-start justify-between">
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted font-medium">{s.label}</div>
                  <div className={cn('mt-1.5 text-3xl font-serif font-semibold tabular-nums', s.accent)}>
                    {s.value}
                  </div>
                </div>
                <div className={cn('h-10 w-10 rounded-lg flex items-center justify-center ring-1', s.ring)}>
                  <Icon className={cn('h-5 w-5', s.accent)} />
                </div>
              </div>
              <div className="mt-3 text-xs text-muted">{s.hint}</div>
            </div>
          );
        })}
      </section>

      {needsSetup ? (
        <SetupChecklist
          demoMode={demoMode}
          connectionStatus={connectionStatus}
          selectedModel={selectedModel}
          models={models}
          onTestConnection={async () => {
            const { ok, error } = await testOllamaConnection();
            if (ok) pushToast({ type: 'success', title: 'Ollama is running' });
            else pushToast({ type: 'error', title: 'Could not reach Ollama', description: error?.message });
          }}
          onDiscover={async () => {
            const { error } = await discoverModels();
            if (!error) pushToast({ type: 'info', title: 'Models refreshed', description: `${models.length} model${models.length === 1 ? '' : 's'} found` });
          }}
          onSelectModel={(name) => {
            setSelectedModel(name);
            pushToast({ type: 'info', title: 'Model selected', description: name });
          }}
          onToggleDemo={() => {
            toggleDemo();
            pushToast({
              type: 'info',
              title: demoMode ? 'Demo Mode turned off' : 'Demo Mode enabled',
              description: demoMode
                ? 'Now using live local Ollama evaluations. Complete steps 2-4 if needed.'
                : 'Use static samples to explore PromptIQ.',
            });
          }}
          onGoLab={() => navigate('/lab')}
        />
      ) : (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <section className="xl:col-span-3 space-y-4">
            <div className="card p-6">
              <div className="flex items-end justify-between mb-5">
                <div>
                  <div className="section-title mb-1.5">Quick Draft</div>
                  <h2 className="heading-md">Start a new prompt</h2>
                  <p className="mt-1 text-sm text-muted max-w-lg">
                    Draft a prompt inline, then evaluate or send it to the Lab for full editing.
                  </p>
                </div>
                <button
                  className="text-xs text-accent font-medium inline-flex items-center gap-1 hover:underline"
                  onClick={() => navigate('/lab')}
                >
                  Open full Lab <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <PromptEditor
                autosaveKey="overview"
                hideCategory
                onImprove={null}
                onEvaluate={() => navigate('/evaluator')}
              />
            </div>
          </section>

          <section className="xl:col-span-2 space-y-6">
            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="section-title mb-1.5">Quick Start</div>
                  <h2 className="heading-md">Templates</h2>
                </div>
                <button
                  onClick={() => navigate('/templates')}
                  className="text-xs text-accent font-medium inline-flex items-center gap-1 hover:underline"
                >
                  View all <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                {quickTemplates.map((t) => {
                  const Icon = templateIcons[t.icon] ?? FileText;
                  return (
                    <button
                      key={t.id}
                      onClick={() => handleQuickStart(t.id)}
                      className="text-left border border-border rounded-lg p-3.5 hover:border-accent/40 hover:shadow-card-hover transition-all bg-white group"
                    >
                      <div className="h-9 w-9 rounded-md bg-border-light text-muted group-hover:text-accent group-hover:bg-accent/10 flex items-center justify-center mb-2 transition-colors">
                        <Icon className="h-4.5 w-4.5 h-[18px] w-[18px]" />
                      </div>
                      <div className="text-sm font-semibold text-ink leading-tight">{t.name}</div>
                      <div className="text-xs text-muted mt-0.5 line-clamp-2 leading-snug">{t.description}</div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="card p-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <div className="section-title mb-1.5">Recent</div>
                  <h2 className="heading-md">Evaluations</h2>
                </div>
                <button
                  onClick={() => navigate('/evaluator')}
                  className="text-xs text-accent font-medium inline-flex items-center gap-1 hover:underline"
                >
                  Evaluator <ArrowRight className="h-3.5 w-3.5" />
                </button>
              </div>
              {evaluations.length === 0 ? (
                <div className="border border-dashed border-border rounded-lg p-6 text-center">
                  <Clock className="h-6 w-6 text-muted mx-auto mb-2" />
                  <div className="text-sm font-medium text-ink">No evaluations yet</div>
                  <p className="text-xs text-muted mt-1 max-w-xs mx-auto leading-relaxed">
                    Run an evaluation from the editor above or the Evaluator page to see scored results here.
                  </p>
                  <div className="mt-4 flex flex-col items-center gap-2">
                    <button
                      className="btn-primary w-full max-w-[220px]"
                      onClick={() => navigate('/evaluator')}
                    >
                      <Scale className="h-4 w-4" />
                      Open Evaluator
                    </button>
                    <div className="text-[11px] text-muted leading-relaxed max-w-[240px]">
                      First, make sure Ollama is running and a model is selected in Settings.
                    </div>
                  </div>
                </div>
              ) : (
                <ul className="space-y-2">
                  {evaluations.map((e) => (
                    <li key={e.id}>
                      <button
                        onClick={() => {
                          setComparison({ original: e });
                          navigate('/evaluator', { state: { evaluationId: e.id } });
                        }}
                        className="w-full flex items-center gap-3 p-2.5 rounded-md hover:bg-border-light transition-colors text-left"
                      >
                        <OverallScoreBadge score={e.overallScore} size="sm" />
                        <div className="flex-1 min-w-0">
                          <div className="text-sm font-medium text-ink truncate">{e.promptTitle}</div>
                          <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatRelativeTime(e.createdAt)}
                            </span>
                            <span>·</span>
                            <span className={scoreToColor(e.overallScore)}>{scoreLabel(e.overallScore)}</span>
                            {e.isDemo && <span className="chip-accent !py-0 !px-1.5 !text-[10px] h-4">Demo</span>}
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
