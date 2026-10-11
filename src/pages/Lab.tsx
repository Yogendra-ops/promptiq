import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  FlaskConical,
  Sparkles,
  Scale,
  GitCompare,
  History,
  Loader2,
  Trash2,
  Copy,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import PromptEditor from '@/components/ui/PromptEditor';
import { ScoreMeter, OverallScoreBadge } from '@/components/ui/ScoreMeter';
import { usePromptStore } from '@/store/usePromptStore';
import type { EvaluationResult, ImprovementResult, SavedPrompt } from '@/types';
import { DIMENSION_LABELS, DIMENSION_WEIGHTS, type EvaluationDimension } from '@/types';
import { cn, copyToClipboard, formatRelativeTime, scoreLabel, scoreToColor, } from '@/lib/utils';
import { storage } from '@/lib/storage';
import type { OllamaError } from '@/services/ollamaService';

export default function Lab() {
  const navigate = useNavigate();
  const [sp] = useSearchParams();
  const promptId = sp.get('prompt') ?? undefined;
  const prompts = usePromptStore((s) => s.prompts);
  const evaluations = usePromptStore((s) => s.evaluations);
  const improvements = usePromptStore((s) => s.improvements);
  const runEvaluate = usePromptStore((s) => s.runEvaluate);
  const runImprove = usePromptStore((s) => s.runImprove);
  const addEvaluation = usePromptStore((s) => s.addEvaluation);
  const addImprovement = usePromptStore((s) => s.addImprovement);
  const setComparison = usePromptStore((s) => s.setComparison);
  const deleteEvaluation = usePromptStore((s) => s.deleteEvaluation);
  const deleteImprovement = usePromptStore((s) => s.deleteImprovement);
  const pushToast = usePromptStore((s) => s.pushToast);

  const [activeTab, setActiveTab] = useState<'editor' | 'history'>('editor');
  const [currentEval, setCurrentEval] = useState<EvaluationResult | null>(null);
  const [currentImp, setCurrentImp] = useState<ImprovementResult | null>(null);
  const [evalLoading, setEvalLoading] = useState(false);
  const [impLoading, setImpLoading] = useState(false);
  const [error, setError] = useState<OllamaError | null>(null);
  const [editorVersion, setEditorVersion] = useState(0);
  const loaded = promptId ? prompts.find((p) => p.id === promptId) : undefined;
  const initialDraft = (() => {
    if (loaded) return { title: loaded.title, content: loaded.content };
    const persisted = storage.getLabState();
    return persisted ?? { title: '', content: '' };
  })();
  const [currentDraft, setCurrentDraft] = useState<{ title: string; content: string }>(initialDraft);

  const historyEntries = useHistoryEntries(promptId, evaluations, improvements);

  useEffect(() => {
    if (promptId) {
      const lastEval = evaluations.find((e) => e.promptId === promptId);
      const lastImp = improvements.find((i) => i.promptId === promptId);
      if (lastEval) setCurrentEval(lastEval);
      if (lastImp) setCurrentImp(lastImp);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [promptId, evaluations.length, improvements.length]);

  async function handleEvaluate(draft: { title: string; content: string }) {
    if (!draft.content.trim()) return;
    setEvalLoading(true);
    setError(null);
    try {
      const r = await runEvaluate({
        title: draft.title || 'Untitled Prompt',
        content: draft.content,
        promptId,
      });
      setCurrentEval(r);
      setComparison({ original: r });
      pushToast({ type: 'success', title: 'Evaluated', description: `${r.overallScore.toFixed(1)}/10 — ${scoreLabel(r.overallScore)}` });
    } catch (e: any) {
      setError(e);
      pushToast({ type: 'error', title: 'Evaluation failed', description: e?.message });
    } finally {
      setEvalLoading(false);
    }
  }

  async function handleImprove(draft: { title: string; content: string }) {
    if (!draft.content.trim()) return;
    setImpLoading(true);
    try {
      const imp = await runImprove({
        title: draft.title || 'Untitled Prompt',
        content: draft.content,
        promptId,
      });
      setCurrentImp(imp);
      if (currentEval) {
        setComparison({ original: currentEval, improvement: imp });
      } else {
        setComparison({ improvement: imp });
      }
      pushToast({ type: 'success', title: 'Improved', description: imp.improvedTitle });
    } catch (e: any) {
      setError(e);
      pushToast({ type: 'error', title: 'Improvement failed', description: e?.message });
    } finally {
      setImpLoading(false);
    }
  }

  function handleSave(p: SavedPrompt) {
    setCurrentDraft({ title: p.title, content: p.content });
  }

  function applyHistory(entry: { type: 'eval' | 'imp'; item: EvaluationResult | ImprovementResult }) {
    if (entry.type === 'eval') {
      const e = entry.item as EvaluationResult;
      setCurrentEval(e);
      setCurrentDraft({ title: e.promptTitle, content: e.promptContent });
      setEditorVersion((v) => v + 1);
      setComparison({ original: e });
    } else {
      const i = entry.item as ImprovementResult;
      setCurrentImp(i);
      setCurrentDraft({ title: i.improvedTitle, content: i.improvedPromptContent });
      setEditorVersion((v) => v + 1);
      if (currentEval) setComparison({ original: currentEval, improvement: i });
      else setComparison({ improvement: i });
    }
    pushToast({ type: 'info', title: 'Loaded from history' });
  }

  async function copyCurrentContent() {
    const ok = await copyToClipboard(currentDraft.content);
    pushToast({ type: ok ? 'success' : 'error', title: ok ? 'Copied' : 'Copy failed' });
  }

  const dimensionsList = Object.keys(DIMENSION_WEIGHTS) as EvaluationDimension[];

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Prompt Lab"
        title="Your prompt editing workspace."
        subtitle={
          loaded
            ? `Editing “${loaded.title}”. Draft, evaluate, improve, and save — without losing your place.`
            : 'Draft, evaluate, improve, and save prompts in a single workspace. Your work is auto-saved as you type.'
        }
        actions={
          <>
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-white">
              <TabButton active={activeTab === 'editor'} onClick={() => setActiveTab('editor')}>
                <FlaskConical className="h-3.5 w-3.5" /> Editor
              </TabButton>
              <TabButton active={activeTab === 'history'} onClick={() => setActiveTab('history')}>
                <History className="h-3.5 w-3.5" /> History
                {historyEntries.length > 0 && (
                  <span className="ml-1 -mr-1 chip !py-0 !px-1.5 !text-[10px] !h-4">
                    {historyEntries.length}
                  </span>
                )}
              </TabButton>
            </div>
            <button className="btn-secondary" onClick={() => navigate('/compare')}>
              <GitCompare className="h-4 w-4" />
              Open Compare
            </button>
          </>
        }
      />

      {activeTab === 'editor' ? (
        <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
          <section className="xl:col-span-3 space-y-4">
            <div className="card p-6">
              <PromptEditor
                key={editorVersion}
                autosaveKey="lab"
                existingPromptId={promptId}
                initialTitle={currentDraft.title}
                initialContent={currentDraft.content}
                saveLabel="Save to Library"
                evalLabel={evalLoading ? 'Evaluating…' : 'Evaluate'}
                evalDisabled={evalLoading}
                improveLabel={impLoading ? 'Improving…' : 'Improve'}
                improveDisabled={impLoading}
                onSave={handleSave}
                onEvaluate={handleEvaluate}
                onImprove={handleImprove}
                onChangeDraft={(draft) => setCurrentDraft(draft)}
                actionsLeft={
                  <button
                    className="btn-secondary"
                    onClick={copyCurrentContent}
                    title="Copy prompt content"
                  >
                    <Copy className="h-4 w-4" />
                    Copy
                  </button>
                }
              />
            </div>

            {error && (
              <div className="card p-5 border-l-[3px] border-l-score-poor text-sm">
                <div className="font-semibold text-ink mb-1">{error.type} · Lab request failed</div>
                <div className="text-muted mb-2 leading-relaxed">{error.message}</div>
                {error.guidance && <div className="text-xs text-muted whitespace-pre-line leading-relaxed">{error.guidance}</div>}
              </div>
            )}
          </section>

          <section className="xl:col-span-2 space-y-4">
            <ResultCard
              title="Latest Evaluation"
              icon={<Scale className="h-4 w-4" />}
              loading={evalLoading}
              empty={
                !currentEval ? (
                  <EmptyHint
                    title="No recent evaluation"
                    body="Run an evaluation to see scores, strengths, and recommendations here."
                  />
                ) : null
              }
            >
              {currentEval && (
                <div className="space-y-4">
                  <div className="flex items-start gap-4">
                    <OverallScoreBadge score={currentEval.overallScore} size="md" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">
                        {currentEval.promptTitle}
                      </div>
                      <div className="text-xs text-muted flex items-center gap-1.5 mt-0.5 flex-wrap">
                        <span>{formatRelativeTime(currentEval.createdAt)}</span>
                        <span className={scoreToColor(currentEval.overallScore)}>
                          {scoreLabel(currentEval.overallScore)}
                        </span>
                        {currentEval.isDemo && <span className="chip-accent !h-5">Demo</span>}
                      </div>
                      <p className="mt-2 text-xs text-ink/80 leading-relaxed line-clamp-3">
                        {currentEval.executiveSummary}
                      </p>
                    </div>
                  </div>
                  <div className="divide-y divide-border-light">
                    {dimensionsList.map((d) => {
                      const s = currentEval.dimensions[d];
                      return (
                        <ScoreMeter
                          key={d}
                          compact
                          score={s.score}
                          label={DIMENSION_LABELS[d]}
                          weight={DIMENSION_WEIGHTS[d]}
                        />
                      );
                    })}
                  </div>
                  <div className="flex gap-2 pt-1">
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        setComparison({ original: currentEval });
                        navigate('/evaluator');
                      }}
                    >
                      Full Evaluator report →
                    </button>
                  </div>
                </div>
              )}
            </ResultCard>

            <ResultCard
              title="Latest Improvement"
              icon={<Sparkles className="h-4 w-4" />}
              loading={impLoading}
              empty={
                !currentImp ? (
                  <EmptyHint
                    title="No recent improvement"
                    body="Improve the prompt to see structural changes and a rewrite here."
                  />
                ) : null
              }
            >
              {currentImp && (
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-semibold text-ink truncate">
                        {currentImp.improvedTitle}
                      </div>
                      <div className="text-xs text-muted mt-0.5">
                        {formatRelativeTime(currentImp.createdAt)} · {currentImp.model}
                        {currentImp.isDemo && ' · Demo'}
                      </div>
                    </div>
                    <button
                      className="btn-ghost !p-1.5 h-7 w-7 shrink-0"
                      onClick={async () => {
                        const ok = await copyToClipboard(currentImp.improvedPromptContent);
                        pushToast({ type: ok ? 'success' : 'error', title: ok ? 'Improved copied' : 'Copy failed' });
                      }}
                      title="Copy improved prompt"
                      aria-label="Copy improved prompt"
                    >
                      <Copy className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <p className="text-xs text-ink/80 leading-relaxed">{currentImp.rationale}</p>
                  {currentImp.changes && currentImp.changes.length > 0 && (
                    <ul className="space-y-1.5">
                      {currentImp.changes.slice(0, 4).map((c, i) => (
                        <li key={i} className="flex items-start gap-2 text-xs text-ink/85 leading-relaxed">
                          <span className="mt-0.5 h-4 w-4 shrink-0 rounded bg-accent/10 text-accent text-[10px] font-semibold flex items-center justify-center">
                            {i + 1}
                          </span>
                          <span>{c}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                  <div className="flex gap-2 pt-1">
                    <button
                      className="btn-secondary text-xs"
                      onClick={() => {
                        setCurrentDraft({
                          title: currentImp.improvedTitle,
                          content: currentImp.improvedPromptContent,
                        });
                        pushToast({ type: 'info', title: 'Improved version loaded in editor' });
                      }}
                    >
                      Load into editor
                    </button>
                    <button
                      className="btn-ghost text-xs"
                      onClick={() => {
                        setComparison({ improvement: currentImp, original: currentEval, improved: null });
                        navigate('/compare', { state: { improvementId: currentImp.id } });
                      }}
                    >
                      View Compare →
                    </button>
                  </div>
                </div>
              )}
            </ResultCard>
          </section>
        </div>
      ) : (
        <HistoryView
          entries={historyEntries}
          onApply={applyHistory}
          onDelete={(t, id) => {
            if (t === 'eval') deleteEvaluation(id);
            else deleteImprovement(id);
            pushToast({ type: 'info', title: 'Removed from history' });
          }}
        />
      )}
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 h-9 text-sm font-medium transition-colors',
        active ? 'bg-accent/10 text-accent' : 'text-ink/70 hover:text-ink hover:bg-border-light'
      )}
    >
      {children}
    </button>
  );
}

function ResultCard({
  title,
  icon,
  children,
  empty,
  loading,
}: {
  title: string;
  icon: React.ReactNode;
  children?: React.ReactNode;
  empty?: React.ReactNode;
  loading?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-4">
        <div className="h-8 w-8 rounded-md bg-accent/5 text-accent ring-1 ring-accent/15 flex items-center justify-center">
          {icon}
        </div>
        <h3 className="heading-md">{title}</h3>
        {loading && <Loader2 className="ml-auto h-4 w-4 text-muted animate-spin" />}
      </div>
      {empty ?? children}
    </div>
  );
}

function EmptyHint({ title, body }: { title: string; body: string }) {
  return (
    <div className="py-4 text-center">
      <div className="text-sm font-medium text-ink">{title}</div>
      <p className="mt-1 text-xs text-muted leading-relaxed max-w-xs mx-auto">{body}</p>
    </div>
  );
}

interface HistoryEntry {
  id: string;
  type: 'eval' | 'imp';
  at: string;
  title: string;
  summary: string;
  score?: number;
  demo?: boolean;
  item: EvaluationResult | ImprovementResult;
}
function useHistoryEntries(
  promptId: string | undefined,
  evals: EvaluationResult[],
  imps: ImprovementResult[]
): HistoryEntry[] {
  const entries: HistoryEntry[] = [];
  for (const e of evals) {
    if (promptId && e.promptId !== promptId) continue;
    entries.push({
      id: e.id,
      type: 'eval',
      at: e.createdAt,
      title: e.promptTitle,
      summary: e.executiveSummary.slice(0, 140),
      score: e.overallScore,
      demo: e.isDemo,
      item: e,
    });
  }
  for (const i of imps) {
    if (promptId && i.promptId !== promptId) continue;
    entries.push({
      id: i.id,
      type: 'imp',
      at: i.createdAt,
      title: i.improvedTitle,
      summary: i.rationale,
      demo: i.isDemo,
      item: i,
    });
  }
  entries.sort((a, b) => +new Date(b.at) - +new Date(a.at));
  return entries;
}

function HistoryView({
  entries,
  onApply,
  onDelete,
}: {
  entries: HistoryEntry[];
  onApply: (e: { type: 'eval' | 'imp'; item: EvaluationResult | ImprovementResult }) => void;
  onDelete: (type: 'eval' | 'imp', id: string) => void;
}) {
  if (entries.length === 0) {
    return (
      <div className="card p-10 text-center border-dashed">
        <History className="h-10 w-10 text-muted mx-auto mb-3 opacity-50" />
        <h3 className="heading-md">No history yet</h3>
        <p className="text-sm text-muted mt-2 max-w-md mx-auto">
          Evaluate or improve a prompt in the Editor tab to build a run history. You'll be able to
          jump back to any previous run here.
        </p>
      </div>
    );
  }
  return (
    <div className="card overflow-hidden">
      <div className="hidden lg:grid grid-cols-12 px-5 py-3 border-b border-border bg-border-light/40 text-[11px] font-semibold uppercase tracking-wider text-muted">
        <div className="col-span-1">Type</div>
        <div className="col-span-3">Title</div>
        <div className="col-span-5">Summary</div>
        <div className="col-span-2">When</div>
        <div className="col-span-1 text-right">Actions</div>
      </div>
      <ul className="divide-y divide-border-light">
        {entries.map((e) => (
          <li
            key={e.id}
            className="flex flex-col gap-2 px-5 py-3 text-sm lg:grid lg:grid-cols-12 lg:gap-3 lg:items-center hover:bg-border-light/60 transition-colors"
          >
            <div className="lg:col-span-1">
              {e.type === 'eval' ? (
                <span className="chip !text-[10px] !py-0 !h-5">
                  <Scale className="h-3 w-3" /> Eval
                </span>
              ) : (
                <span className="chip-accent !text-[10px] !py-0 !h-5">
                  <Sparkles className="h-3 w-3" /> Improve
                </span>
              )}
            </div>
            <div className="lg:col-span-3 font-medium text-ink truncate flex items-center gap-2 min-w-0">
              {e.title}
              {typeof e.score === 'number' && (
                <span className={cn('tabular-nums text-xs font-semibold', scoreToColor(e.score))}>
                  {e.score.toFixed(1)}
                </span>
              )}
              {e.demo && <span className="chip !py-0 !px-1.5 !text-[10px] !h-4">Demo</span>}
            </div>
            <div className="lg:col-span-5 text-muted text-xs leading-relaxed line-clamp-2">
              {e.summary || '—'}
            </div>
            <div className="lg:col-span-2 text-xs text-muted whitespace-nowrap">
              <span className="lg:hidden text-[11px] font-medium mr-1.5">When:</span>
              {formatRelativeTime(e.at)}
            </div>
            <div className="lg:col-span-1 flex justify-end gap-1">
              <button
                onClick={() => onApply({ type: e.type, item: e.item })}
                className="btn-ghost !p-1.5 h-7 w-7"
                title="Load this run"
                aria-label="Load this run"
              >
                <span className="text-xs font-semibold text-accent">Load</span>
              </button>
              <button
                onClick={() => onDelete(e.type, e.id)}
                className="btn-ghost !p-1.5 h-7 w-7 text-score-poor hover:bg-score-poor/10"
                title="Delete"
                aria-label="Delete run"
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
