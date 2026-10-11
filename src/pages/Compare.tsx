import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  GitCompare,
  ArrowRight,
  Copy,
  Save,
  Sparkles,
  FileDown,
  FlaskConical,
  BookOpen,
  Plus,
  Minus,
  Equal,
  Shuffle,
  AlertTriangle,
  XCircle,
  Loader2,
  Settings,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import { ScoreMeter, OverallScoreBadge } from '@/components/ui/ScoreMeter';
import PromptCounters from '@/components/ui/PromptCounters';
import { usePromptStore } from '@/store/usePromptStore';
import {
  DIMENSION_WEIGHTS,
  DIMENSION_LABELS,
  type EvaluationDimension,
  type EvaluationResult,
  type ImprovementResult,
} from '@/types';
import { cn, copyToClipboard, computeCounters, downloadAsFile, scoreLabel, scoreToColor, slugify } from '@/lib/utils';
import type { OllamaError } from '@/services/ollamaService';

export default function Compare() {
  const navigate = useNavigate();
  const comparison = usePromptStore((s) => s.comparison);
  const evaluations = usePromptStore((s) => s.evaluations);
  const improvements = usePromptStore((s) => s.improvements);
  const runEvaluate = usePromptStore((s) => s.runEvaluate);
  const addImprovement = usePromptStore((s) => s.addImprovement);
  const setComparison = usePromptStore((s) => s.setComparison);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const pushToast = usePromptStore((s) => s.pushToast);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const selectedModel = usePromptStore((s) => s.settings.ollama.selectedModel);
  const [loadingImproved, setLoadingImproved] = useState(false);
  const [error, setError] = useState<OllamaError | null>(null);

  const dimensionsList = useMemo(
    () => Object.keys(DIMENSION_WEIGHTS) as EvaluationDimension[],
    []
  );

  const original = comparison.original ?? evaluations[0] ?? null;
  const improvement = comparison.improvement ?? improvements[0] ?? null;
  const improvedEval: EvaluationResult | null = comparison.improved ?? null;

  async function evaluateImproved() {
    if (!improvement) return;
    setLoadingImproved(true);
    setError(null);
    try {
      const r = await runEvaluate({
        title: improvement.improvedTitle,
        content: improvement.improvedPromptContent,
      });
      setComparison({ improved: r });
      pushToast({ type: 'success', title: 'Improved prompt evaluated', description: `Score: ${r.overallScore.toFixed(1)}/10` });
    } catch (e: any) {
      setError(e as OllamaError);
      pushToast({ type: 'error', title: 'Evaluation failed', description: e.message ?? 'Unknown error' });
    } finally {
      setLoadingImproved(false);
    }
  }

  function saveImproved() {
    if (!improvement) return;
    const saved = upsertPrompt({
      title: improvement.improvedTitle,
      content: improvement.improvedPromptContent,
      category: 'General',
      tags: ['improved'],
      lastScore: improvedEval?.overallScore,
    });
    pushToast({ type: 'success', title: 'Saved improved prompt', description: saved.title });
  }

  async function copySide(which: 'original' | 'improved') {
    const text =
      which === 'original'
        ? original?.promptContent ?? improvement?.originalPromptContent ?? ''
        : improvement?.improvedPromptContent ?? '';
    const ok = await copyToClipboard(text);
    pushToast({
      type: ok ? 'success' : 'error',
      title: ok ? `${which === 'original' ? 'Original' : 'Improved'} copied` : 'Copy failed',
    });
  }

  function exportJSON() {
    if (!original && !improvement) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      original: original ?? null,
      improvement: improvement ?? null,
      improvedEvaluation: improvedEval ?? null,
    };
    const name = slugify(original?.promptTitle ?? improvement?.originalTitle ?? 'comparison');
    downloadAsFile(`${name}-compare.json`, JSON.stringify(payload, null, 2), 'application/json');
    pushToast({ type: 'success', title: 'Exported comparison JSON' });
  }

  function editInLab(which: 'original' | 'improved') {
    const data =
      which === 'original'
        ? {
            title: original?.promptTitle ?? improvement?.originalTitle ?? '',
            content: original?.promptContent ?? improvement?.originalPromptContent ?? '',
          }
        : {
            title: improvement?.improvedTitle ?? '',
            content: improvement?.improvedPromptContent ?? '',
          };
    const saved = upsertPrompt({
      title: data.title || 'Untitled Prompt',
      content: data.content,
      category: 'General',
    });
    navigate(`/lab?prompt=${saved.id}`);
  }

  const delta =
    original && improvedEval
      ? Math.round((improvedEval.overallScore - original.overallScore) * 10) / 10
      : null;

  const hasContent = !!(original || improvement);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Comparison"
        title="Original vs. improved prompts."
        subtitle="See exactly what changed between the original and rewritten prompt, with scores, counts, and structural deltas side by side."
        actions={
          <>
            <button
              className="btn-secondary"
              disabled={!original && !improvement}
              onClick={exportJSON}
            >
              <FileDown className="h-4 w-4" />
              Export JSON
            </button>
            <button
              className="btn-primary"
              disabled={!improvement || !!improvedEval}
              onClick={evaluateImproved}
            >
              {loadingImproved ? (
                <span className="inline-flex items-center gap-2">
                  <span className="h-4 w-4 rounded-full border-2 border-white/60 border-t-white animate-spin" />
                  Evaluating Improved…
                </span>
              ) : (
                <>
                  <Shuffle className="h-4 w-4" />
                  Evaluate Improved
                </>
              )}
            </button>
          </>
        }
      />

      {!hasContent ? (
        <EmptyCompareState
          onGoEvaluator={() => navigate('/evaluator')}
          onGoLab={() => navigate('/lab')}
          onGoSettings={() => navigate('/settings')}
          liveSetupMissing={!demoMode && !selectedModel}
        />
      ) : (
        <>
          {error && (
            <div className="card p-5 border-l-[3px] border-l-score-poor space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-score-poor shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">
                    {error.type === 'timeout'
                      ? 'Request timed out while evaluating improved prompt'
                      : error.type === 'network'
                        ? 'Unable to reach Ollama'
                        : error.type === 'validation'
                          ? 'Configuration required'
                          : 'Failed to evaluate improved prompt'}
                  </div>
                  <div className="mt-0.5 text-sm text-muted leading-relaxed">{error.message}</div>
                </div>
                <button
                  className="btn-ghost !p-1.5 h-7 w-7 text-muted hover:text-ink"
                  onClick={() => setError(null)}
                  title="Dismiss"
                  aria-label="Dismiss error"
                >
                  <XCircle className="h-4 w-4" />
                </button>
              </div>
              {error.guidance && (
                <div className="text-xs text-muted leading-relaxed pl-7 whitespace-pre-line">
                  {error.guidance}
                </div>
              )}
              <div className="flex flex-wrap gap-2 pl-7">
                <button className="btn-secondary" onClick={evaluateImproved} disabled={loadingImproved}>
                  {loadingImproved ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  Retry Evaluation
                </button>
                <button className="btn-secondary" onClick={() => navigate('/settings')}>
                  Open Settings
                </button>
              </div>
            </div>
          )}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              label="Original Score"
              score={original?.overallScore}
              side="left"
            />
            <DeltaCard
              delta={delta}
              hasImproved={!!improvedEval}
              onClick={() => !improvedEval && evaluateImproved()}
            />
            <ScoreCard
              label="Improved Score"
              score={improvedEval?.overallScore}
              side="right"
              emptyLabel={!improvement ? 'No improved prompt' : 'Not yet evaluated'}
            />
          </section>

          <div className="card overflow-hidden">
            <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
              <PromptPanel
                side="Original"
                title={original?.promptTitle ?? improvement?.originalTitle ?? '(untitled)'}
                model={original?.model}
                score={original?.overallScore}
                content={original?.promptContent ?? improvement?.originalPromptContent ?? ''}
                accent="left"
                onCopy={() => copySide('original')}
                onEdit={() => editInLab('original')}
                onSave={() => {
                  if (!original && !improvement) return;
                  const saved = upsertPrompt({
                    title: original?.promptTitle ?? improvement?.originalTitle ?? 'Original Prompt',
                    content: original?.promptContent ?? improvement?.originalPromptContent ?? '',
                    category: 'General',
                  });
                  pushToast({ type: 'success', title: 'Saved', description: saved.title });
                }}
              />
              <PromptPanel
                side="Improved"
                title={improvement?.improvedTitle ?? 'Improved version'}
                model={improvedEval?.model ?? improvement?.model}
                score={improvedEval?.overallScore}
                content={improvement?.improvedPromptContent ?? ''}
                accent="right"
                onCopy={() => copySide('improved')}
                onEdit={() => editInLab('improved')}
                onSave={saveImproved}
                emptyHint={
                  !improvement
                    ? 'Improve a prompt in Evaluator or Lab to compare it here.'
                    : undefined
                }
                badge={
                  improvement?.isDemo ? (
                    <span className="chip-accent !h-5">Demo</span>
                  ) : undefined
                }
              />
            </div>
          </div>

          {original && improvedEval && (
            <section className="card p-6">
              <div className="flex items-center justify-between mb-5">
                <div>
                  <div className="section-title mb-1.5">Per-Dimension Changes</div>
                  <h3 className="heading-md">Dimension deltas</h3>
                </div>
                <div className="text-xs text-muted flex items-center gap-3">
                  <span className="inline-flex items-center gap-1">
                    <Plus className="h-3 w-3 text-score-excellent" /> gain
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Minus className="h-3 w-3 text-score-poor" /> loss
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <Equal className="h-3 w-3 text-muted" /> no change
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border-light">
                {dimensionsList.map((dim) => {
                  const a = original.dimensions[dim];
                  const b = improvedEval.dimensions[dim];
                  const d = Math.round((b.score - a.score) * 10) / 10;
                  return (
                    <div key={dim} className="py-2 grid grid-cols-12 gap-4 items-center">
                      <div className="col-span-12 lg:col-span-4">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold text-ink">
                            {DIMENSION_LABELS[dim]}
                          </span>
                          <span className="chip !h-5 !text-[10px]">
                            {Math.round(DIMENSION_WEIGHTS[dim] * 100)}%
                          </span>
                          {d !== 0 && (
                            <span
                              className={cn(
                                'inline-flex items-center gap-0.5 text-xs font-semibold',
                                d > 0 ? 'text-score-excellent' : 'text-score-poor'
                              )}
                            >
                              {d > 0 ? <Plus className="h-3 w-3" /> : <Minus className="h-3 w-3" />}
                              {Math.abs(d).toFixed(1)}
                            </span>
                          )}
                          {d === 0 && (
                            <span className="inline-flex items-center gap-0.5 text-xs font-semibold text-muted">
                              <Equal className="h-3 w-3" /> 0.0
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="col-span-6 lg:col-span-4">
                        <ScoreMeter
                          compact
                          score={a.score}
                          label="Original"
                        />
                      </div>
                      <div className="col-span-6 lg:col-span-4">
                        <ScoreMeter
                          compact
                          score={b.score}
                          label="Improved"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="heading-md mb-3">Original Stats</h3>
              <PromptCounters content={original?.promptContent ?? improvement?.originalPromptContent ?? ''} />
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="heading-md">Improved Stats</h3>
                {improvement && (
                  <DeltaChip
                    original={computeCounters(original?.promptContent ?? improvement.originalPromptContent)}
                    improved={computeCounters(improvement.improvedPromptContent)}
                  />
                )}
              </div>
              <PromptCounters content={improvement?.improvedPromptContent ?? ''} />
            </div>
          </section>

          {improvement && (
            <section className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="section-title mb-1.5">Structural Changes</div>
                  <h3 className="heading-md">What the improvement changed</h3>
                  <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
                    {improvement.rationale}
                  </p>
                </div>
                <div className="hidden md:block">
                  <OverallScoreBadge
                    score={
                      original && improvedEval
                        ? Math.max(0, Math.min(10, (improvedEval.overallScore + original.overallScore) / 2 + 0.4))
                        : improvedEval?.overallScore ?? 8.2
                    }
                    size="sm"
                  />
                </div>
              </div>
              {improvement.changes && improvement.changes.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                  {improvement.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-ink/90 leading-relaxed">
                      <span className="mt-1 h-5 w-5 shrink-0 rounded-md bg-accent/10 text-accent flex items-center justify-center text-[11px] font-semibold">
                        {i + 1}
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No change-list recorded for this improvement.</p>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ScoreCard({
  label,
  score,
  side,
  emptyLabel,
}: {
  label: string;
  score?: number;
  side: 'left' | 'right';
  emptyLabel?: string;
}) {
  return (
    <div
      className={cn(
        'card p-5',
        side === 'left' && 'md:rounded-tr-none',
        side === 'right' && 'md:rounded-tl-none'
      )}
    >
      <div className="flex items-center justify-between">
        <div>
          <div className="section-title">{label}</div>
          {typeof score === 'number' ? (
            <>
              <div className={cn('mt-1 text-3xl font-serif font-semibold tabular-nums', scoreToColor(score))}>
                {score.toFixed(1)}
                <span className="text-lg text-muted font-normal">/10</span>
              </div>
              <div className="text-xs font-medium mt-0.5 text-ink/70">{scoreLabel(score)}</div>
            </>
          ) : (
            <>
              <div className="mt-1 text-3xl font-serif font-semibold text-muted/50">—</div>
              <div className="text-xs mt-0.5 text-muted">{emptyLabel ?? 'Not evaluated'}</div>
            </>
          )}
        </div>
        {typeof score === 'number' && (
          <div className="hidden sm:block">
            <OverallScoreBadge score={score} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaCard({
  delta,
  hasImproved,
  onClick,
}: {
  delta: number | null;
  hasImproved: boolean;
  onClick: () => void;
}) {
  if (hasImproved && delta !== null) {
    const positive = delta > 0;
    const neutral = delta === 0;
    return (
      <div
        className={cn(
          'card p-5 -mt-0 md:-mx-4 md:mt-0 relative z-10 md:shadow-card-hover md:border-accent/30',
          neutral ? 'border-border' : positive ? 'border-score-excellent/30' : 'border-score-poor/30'
        )}
      >
        <div className="section-title">Delta</div>
        <div className="mt-1 flex items-baseline gap-2">
          <span
            className={cn(
              'text-3xl font-serif font-semibold tabular-nums',
              neutral ? 'text-muted' : positive ? 'text-score-excellent' : 'text-score-poor'
            )}
          >
            {positive ? '+' : ''}
            {delta.toFixed(1)}
          </span>
          <span className="text-sm text-muted">overall</span>
        </div>
        <div className="text-xs mt-0.5 text-ink/70">
          {positive ? 'Net improvement over baseline' : neutral ? 'No change' : 'Lower score than baseline'}
        </div>
      </div>
    );
  }
  return (
    <button
      onClick={onClick}
      className="card p-5 text-left hover:shadow-card-hover border-accent/30 transition-shadow -mt-0 md:-mx-4 md:mt-0 md:relative md:z-10 group"
    >
      <div className="section-title text-accent">Pending</div>
      <div className="mt-1 text-2xl font-serif font-semibold text-ink flex items-center gap-2">
        <span>Run evaluation</span>
        <ArrowRight className="h-5 w-5 text-accent group-hover:translate-x-0.5 transition-transform" />
      </div>
      <div className="text-xs mt-1 text-muted">Score the improved prompt to see deltas.</div>
    </button>
  );
}

function PromptPanel({
  side,
  title,
  content,
  score,
  model,
  accent,
  onCopy,
  onEdit,
  onSave,
  emptyHint,
  badge,
}: {
  side: string;
  title: string;
  content: string;
  score?: number;
  model?: string;
  accent: 'left' | 'right';
  onCopy: () => void;
  onEdit: () => void;
  onSave: () => void;
  emptyHint?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'flex items-center justify-between px-6 py-3 border-b border-border',
          accent === 'right' ? 'bg-accent/[0.03]' : 'bg-white'
        )}
      >
        <div className="flex items-center gap-2 min-w-0">
          <span
            className={cn(
              'chip !py-0 !px-2 !h-6 text-[11px] font-semibold',
              accent === 'right' ? '!border-accent/20 !bg-accent/10 !text-accent' : ''
            )}
          >
            {side}
          </span>
          <span className="text-sm font-semibold text-ink truncate">{title}</span>
          {badge}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {typeof score === 'number' && (
            <span className={cn('text-xs font-semibold tabular-nums mr-1', scoreToColor(score))}>
              {score.toFixed(1)}
            </span>
          )}
          <button className="btn-ghost !p-1.5 h-7 w-7" title="Copy" onClick={onCopy} aria-label="Copy result">
            <Copy className="h-3.5 w-3.5" />
          </button>
          <button className="btn-ghost !p-1.5 h-7 w-7" title="Save to Library" onClick={onSave} aria-label="Save to library">
            <Save className="h-3.5 w-3.5" />
          </button>
          <button className="btn-ghost !p-1.5 h-7 w-7" title="Edit in Lab" onClick={onEdit} aria-label="Edit in Lab">
            <FlaskConical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <div className="p-6 flex-1 min-h-[280px]">
        {!content.trim() ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted py-8">
            <BookOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm">{emptyHint ?? 'No content to display.'}</p>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90 scrollbar-thin max-h-[520px] overflow-y-auto">
            {content}
          </pre>
        )}
      </div>
      {model && (
        <div className="px-6 py-2 border-t border-border text-[11px] text-muted flex items-center gap-2">
          <Sparkles className="h-3 w-3" />
          Model: <span className="font-medium text-ink/80">{model}</span>
        </div>
      )}
    </div>
  );
}

function DeltaChip({
  original,
  improved,
}: {
  original: { words: number; estimatedTokens: number; characters: number };
  improved: { words: number; estimatedTokens: number; characters: number };
}) {
  const w = improved.words - original.words;
  const t = improved.estimatedTokens - original.estimatedTokens;
  return (
    <span className="chip !text-[10px] !h-5">
      {w >= 0 ? '+' : ''}
      {w} words · {t >= 0 ? '+' : ''}
      {t} tokens
    </span>
  );
}

function EmptyCompareState({
  onGoEvaluator,
  onGoLab,
  onGoSettings,
  liveSetupMissing,
}: {
  onGoEvaluator: () => void;
  onGoLab: () => void;
  onGoSettings?: () => void;
  liveSetupMissing?: boolean;
}) {
  const settings = onGoSettings ?? undefined;
  return (
    <div className="space-y-4">
      {liveSetupMissing && (
        <div className="card p-5 border-l-[3px] border-l-score-fair flex items-start gap-3">
          <Settings className="h-5 w-5 text-score-fair shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-sm font-semibold text-ink">Select a model before comparing</div>
            <div className="mt-0.5 text-xs text-muted leading-relaxed">
              Live mode is on but no local model is selected yet. Open Settings to scan available
              models and pick one, or toggle Demo Mode in the top bar to see sample side-by-side
              comparisons immediately.
            </div>
          </div>
          {settings && (
            <button className="btn-secondary" onClick={settings}>
              <Settings className="h-4 w-4" />
              Open Settings
            </button>
          )}
        </div>
      )}
      <div className="card p-10 border-dashed text-center">
        <div className="h-14 w-14 rounded-full bg-accent/5 text-accent flex items-center justify-center mx-auto mb-4 ring-1 ring-accent/20">
          <GitCompare className="h-7 w-7" />
        </div>
        <h3 className="heading-md">Nothing to compare yet</h3>
        <p className="mt-2 text-sm text-muted max-w-xl mx-auto leading-relaxed">
          Evaluate and improve a prompt in the Evaluator or Prompt Lab. After you improve a prompt,
          you'll see the original and improved versions side-by-side here with per-dimension deltas,
          counters, and a change-list of structural edits.
        </p>
        <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
          <button className="btn-secondary" onClick={onGoEvaluator}>
            <Sparkles className="h-4 w-4" />
            Go to Evaluator
          </button>
          <button className="btn-primary" onClick={onGoLab}>
            <FlaskConical className="h-4 w-4" />
            Open Prompt Lab
          </button>
        </div>
      </div>
    </div>
  );
}
