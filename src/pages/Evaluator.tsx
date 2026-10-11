import { useEffect, useState, useMemo, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Scale,
  Sparkles,
  Loader2,
  Save,
  Copy,
  FileDown,
  ArrowRight,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Lightbulb,
  BookOpen,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import PromptEditor from '@/components/ui/PromptEditor';
import ModelSelector from '@/components/ui/ModelSelector';
import { ScoreMeter, OverallScoreBadge } from '@/components/ui/ScoreMeter';
import { usePromptStore } from '@/store/usePromptStore';
import { DIMENSION_WEIGHTS, DIMENSION_LABELS, DIMENSION_DESCRIPTIONS, type EvaluationDimension, type EvaluationResult } from '@/types';
import {
  cn,
  copyToClipboard,
  downloadAsFile,
  exportEvaluationToMarkdown,
  formatDateTime,
  scoreLabel,
  scoreToColor,
  slugify,
} from '@/lib/utils';
import type { OllamaError } from '@/services/ollamaService';

export default function Evaluator() {
  const location = useLocation() as { state?: { evaluationId?: string; promptId?: string } };
  const navigate = useNavigate();
  const evaluations = usePromptStore((s) => s.evaluations);
  const prompts = usePromptStore((s) => s.prompts);
  const runEvaluate = usePromptStore((s) => s.runEvaluate);
  const runImprove = usePromptStore((s) => s.runImprove);
  const addImprovement = usePromptStore((s) => s.addImprovement);
  const setComparison = usePromptStore((s) => s.setComparison);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const pushToast = usePromptStore((s) => s.pushToast);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const selectedModel = usePromptStore((s) => s.settings.ollama.selectedModel);

  const initialEval = location.state?.evaluationId
    ? evaluations.find((e) => e.id === location.state!.evaluationId)
    : undefined;
  const comparisonOriginal = usePromptStore((s) => s.comparison.original);

  const resultsRef = useRef<HTMLElement>(null);
  const [result, setResult] = useState<EvaluationResult | null>(initialEval ?? comparisonOriginal ?? null);
  const [loading, setLoading] = useState(false);
  const [improving, setImproving] = useState(false);
  const [error, setError] = useState<OllamaError | null>(null);

  const initialPromptFromState = location.state?.promptId
    ? prompts.find((p) => p.id === location.state!.promptId)
    : undefined;

  const [editorState, setEditorState] = useState<{ title: string; content: string; promptId?: string }>({
    title: initialPromptFromState?.title ?? '',
    content: initialPromptFromState?.content ?? '',
    promptId: initialPromptFromState?.id,
  });

  useEffect(() => {
    if (result) {
      setEditorState({
        title: result.promptTitle,
        content: result.promptContent,
        promptId: result.promptId,
      });
    } else if (location.state?.promptId) {
      const p = prompts.find((x) => x.id === location.state!.promptId);
      if (p) {
        setEditorState({
          title: p.title,
          content: p.content,
          promptId: p.id,
        });
      }
    }
  }, [result?.id, location.state?.promptId, prompts]);

  const canUseLive = !demoMode && !!selectedModel;

  async function handleEvaluate() {
    const { title, content } = editorState;
    if (!content.trim()) {
      pushToast({ type: 'error', title: 'Prompt required', description: 'Write or paste a prompt to evaluate.' });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const r = await runEvaluate({
        title: title || 'Untitled Prompt',
        content,
        promptId: editorState.promptId,
      });
      setResult(r);
      if (typeof window !== 'undefined' && window.innerWidth < 1280) {
        setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth' }), 100);
      }
      pushToast({
        type: 'success',
        title: 'Evaluation complete',
        description: `Overall ${r.overallScore.toFixed(1)}/10 — ${scoreLabel(r.overallScore)}`,
      });
    } catch (e: any) {
      setError(e);
      pushToast({ type: 'error', title: 'Evaluation failed', description: e?.message ?? 'Unknown error' });
    } finally {
      setLoading(false);
    }
  }

  async function handleImprove() {
    if (!result) return;
    setImproving(true);
    try {
      const imp = await runImprove({
        title: result.promptTitle,
        content: result.promptContent,
        promptId: result.promptId,
      });
      addImprovement(imp);
      setComparison({ original: result, improvement: imp, improved: null });
      pushToast({ type: 'success', title: 'Improvement ready', description: imp.improvedTitle });
      navigate('/compare', { state: { improvementId: imp.id } });
    } catch (e: any) {
      pushToast({ type: 'error', title: 'Improvement failed', description: e?.message ?? 'Unknown error' });
    } finally {
      setImproving(false);
    }
  }

  function savePrompt() {
    if (!result) return;
    const saved = upsertPrompt({
      id: result.promptId,
      title: result.promptTitle,
      content: result.promptContent,
      lastScore: result.overallScore,
    });
    setEditorState((s) => ({ ...s, promptId: saved.id }));
  }

  async function copyReport() {
    if (!result) return;
    const ok = await copyToClipboard(exportEvaluationToMarkdown(result));
    pushToast({
      type: ok ? 'success' : 'error',
      title: ok ? 'Report copied' : 'Copy failed',
      description: ok ? 'Full markdown report is on your clipboard.' : 'Try exporting instead.',
    });
  }

  function exportMD() {
    if (!result) return;
    const md = exportEvaluationToMarkdown(result);
    const filename = `${slugify(result.promptTitle) || 'prompt'}-evaluation-${new Date().toISOString().slice(0, 10)}.md`;
    downloadAsFile(filename, md, 'text/markdown');
    pushToast({ type: 'success', title: 'Exported Markdown', description: filename });
  }

  const dimensionsList = useMemo(
    () => (Object.keys(DIMENSION_WEIGHTS) as EvaluationDimension[]),
    []
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Evaluator"
        title="Prompt evaluation, scored objectively."
        subtitle="Five weighted dimensions (Clarity, Context, Specificity, Constraints, Output Expectations) produce a calibrated overall score with executive feedback."
        actions={
          <>
            <button
              className="btn-secondary"
              onClick={() => navigate('/lab')}
            >
              <BookOpen className="h-4 w-4" />
              Edit in Lab
            </button>
            <button
              className="btn-primary"
              onClick={handleEvaluate}
              disabled={loading || !editorState.content.trim()}
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              {loading ? 'Evaluating…' : 'Run Evaluation'}
            </button>
          </>
        }
      />

      <div className="grid grid-cols-1 xl:grid-cols-5 gap-6">
        <section className="xl:col-span-2 space-y-4">
          <div className="card p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <div className="section-title mb-1.5">Prompt Under Test</div>
                <h2 className="heading-md">Inputs</h2>
              </div>
              {!canUseLive && !demoMode && (
                <span className="chip border-score-fair/30 bg-score-fair/5 text-score-fair">
                  <AlertTriangle className="h-3 w-3" />
                  No live model
                </span>
              )}
            </div>
            <ModelSelector />
            <div className="pt-2 border-t border-border">
              <label className="label">Prompt Title</label>
              <input
                className="input h-11 font-medium"
                placeholder="e.g. Product requirements summarisation"
                value={editorState.title}
                onChange={(e) => setEditorState((s) => ({ ...s, title: e.target.value }))}
              />
            </div>
            <div>
              <label className="label">Prompt Content</label>
              <textarea
                className="textarea min-h-[220px] font-mono text-[13px]"
                placeholder="Paste the prompt you want evaluated."
                value={editorState.content}
                onChange={(e) => setEditorState((s) => ({ ...s, content: e.target.value }))}
                spellCheck={false}
              />
            </div>
            {editorState.promptId && (
              <div className="text-xs text-muted">
                Linked to saved prompt:{' '}
                <span className="font-medium text-ink">
                  {prompts.find((p) => p.id === editorState.promptId)?.title ?? '(unknown)'}
                </span>
              </div>
            )}
          </div>

          {error && (
            <div className="card p-5 border-l-[3px] border-l-score-poor space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-score-poor shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">
                    {error.type === 'timeout' ? 'Request timed out' : error.type === 'network' ? 'Unable to reach Ollama' : error.type === 'validation' ? 'Configuration required' : 'Evaluation failed'}
                  </div>
                  <div className="mt-0.5 text-sm text-muted leading-relaxed">{error.message}</div>
                </div>
              </div>
              {error.guidance && (
                <div className="text-xs text-muted leading-relaxed pl-7 whitespace-pre-line">{error.guidance}</div>
              )}
              <div className="flex gap-2 pl-7">
                <button
                  className="btn-secondary"
                  onClick={() => {
                    setError(null);
                    setEditorState((s) => ({ ...s }));
                    handleEvaluate();
                  }}
                >
                  Retry
                </button>
                <button
                  className="btn-secondary"
                  onClick={() => navigate('/settings')}
                >
                  Open Settings
                </button>
              </div>
            </div>
          )}
        </section>

        <section ref={resultsRef} className="xl:col-span-3 space-y-4">
          {!result ? (
            <EmptyEvaluatorState />
          ) : (
            <>
              <div className="card p-6">
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-6">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <div className="section-title">Overall Score</div>
                      {result.isDemo && <span className="chip-accent !h-5">Demo result</span>}
                    </div>
                    <h2 className="heading-lg mt-1">{result.promptTitle}</h2>
                    <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
                      <span>Model: <span className="font-medium text-ink">{result.model}</span></span>
                      <span>Run: <span className="font-medium text-ink">{formatDateTime(result.createdAt)}</span></span>
                      <span className={cn('font-medium', scoreToColor(result.overallScore))}>
                        {scoreLabel(result.overallScore)}
                      </span>
                    </div>
                    <p className="mt-4 text-[15px] leading-relaxed text-ink/90">{result.executiveSummary}</p>
                  </div>
                  <div className="md:pl-6 md:border-l md:border-border shrink-0">
                    <OverallScoreBadge score={result.overallScore} size="lg" />
                  </div>
                </div>
              </div>

              <div className="card p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="heading-md">Dimension Scores</h3>
                  <span className="text-xs text-muted">
                    Weighted average computed in application code
                  </span>
                </div>
                <div className="divide-y divide-border-light">
                  {dimensionsList.map((dim) => {
                    const d = result.dimensions[dim];
                    return (
                      <div key={dim} className="py-2.5">
                        <ScoreMeter
                          score={d.score}
                          label={DIMENSION_LABELS[dim]}
                          weight={DIMENSION_WEIGHTS[dim]}
                          description={DIMENSION_DESCRIPTIONS[dim]}
                        />
                        <p className="mt-1.5 mb-2.5 text-sm text-ink/80 leading-relaxed pl-0.5">
                          {d.feedback}
                        </p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <InsightList
                  title="Strengths"
                  icon={CheckCircle2}
                  accent="text-score-excellent"
                  ring="ring-score-excellent/20 bg-score-excellent/5"
                  items={result.strengths}
                />
                <InsightList
                  title="Areas to Improve"
                  icon={XCircle}
                  accent="text-score-poor"
                  ring="ring-score-poor/20 bg-score-poor/5"
                  items={result.weaknesses}
                />
              </div>

              <div className="card p-6">
                <div className="flex items-center gap-2 mb-4">
                  <div className={cn('h-8 w-8 rounded-md ring-1 flex items-center justify-center', 'ring-score-good/20 bg-score-good/5')}>
                    <Lightbulb className="h-4 w-4 text-score-good" />
                  </div>
                  <div>
                    <div className="heading-md">Actionable Recommendations</div>
                    <div className="text-xs text-muted">Prioritised list of concrete changes.</div>
                  </div>
                </div>
                {result.recommendations.length === 0 ? (
                  <div className="text-sm text-muted">No recommendations available for this evaluation.</div>
                ) : (
                  <ol className="space-y-2.5">
                    {result.recommendations.map((r, idx) => (
                      <li key={idx} className="flex gap-3">
                        <div className="mt-0.5 h-6 w-6 shrink-0 rounded-full bg-border-light text-ink font-semibold text-xs flex items-center justify-center">
                          {idx + 1}
                        </div>
                        <p className="text-sm text-ink/90 leading-relaxed pt-0.5">{r}</p>
                      </li>
                    ))}
                  </ol>
                )}
              </div>

              <div className="card p-5 flex flex-wrap items-center gap-2 justify-between">
                <div className="text-xs text-muted">
                  Report ready. You can improve, save, copy, or export.
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button className="btn-secondary" onClick={exportMD}>
                    <FileDown className="h-4 w-4" />
                    Export Markdown
                  </button>
                  <button className="btn-secondary" onClick={copyReport}>
                    <Copy className="h-4 w-4" />
                    Copy Report
                  </button>
                  <button className="btn-secondary" onClick={savePrompt}>
                    <Save className="h-4 w-4" />
                    Save to Library
                  </button>
                  <button
                    className="btn-primary"
                    onClick={handleImprove}
                    disabled={improving}
                  >
                    {improving ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {improving ? 'Improving…' : 'Improve Prompt'}
                    <ArrowRight className="h-4 w-4 -mr-1" />
                  </button>
                </div>
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function EmptyEvaluatorState() {
  return (
    <div className="card p-10 text-center border-dashed border-border">
      <div className="h-14 w-14 rounded-full bg-accent/5 text-accent flex items-center justify-center mx-auto mb-4 ring-1 ring-accent/20">
        <Scale className="h-7 w-7" />
      </div>
      <h3 className="heading-md">No evaluation yet</h3>
      <p className="mt-2 text-sm text-muted max-w-md mx-auto leading-relaxed">
        Write or paste a prompt on the left and click <span className="font-medium text-ink">Run Evaluation</span>.
        You'll receive a weighted overall score, per-dimension feedback, strengths, weaknesses, and recommendations.
      </p>
      <div className="mt-5 text-xs text-muted max-w-sm mx-auto space-y-1 text-left bg-border-light/40 rounded-lg p-4 border border-border">
        <div className="font-semibold text-ink text-sm mb-1.5">Before running your first evaluation:</div>
        <div className="flex items-start gap-2 leading-relaxed">
          <span className="text-accent font-semibold shrink-0">1.</span>
          <span>Ensure Ollama is running locally (default: <code className="bg-white border border-border rounded px-1">http://localhost:11434</code>).</span>
        </div>
        <div className="flex items-start gap-2 leading-relaxed">
          <span className="text-accent font-semibold shrink-0">2.</span>
          <span>Install a model via terminal: <code className="bg-white border border-border rounded px-1">ollama pull llama3.2</code></span>
        </div>
        <div className="flex items-start gap-2 leading-relaxed">
          <span className="text-accent font-semibold shrink-0">3.</span>
          <span>Go to <span className="text-ink font-medium">Settings</span> → test connection → select a default model.</span>
        </div>
      </div>
    </div>
  );
}

function InsightList({
  title,
  icon: Icon,
  items,
  accent,
  ring,
}: {
  title: string;
  icon: any;
  items: string[];
  accent: string;
  ring: string;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className={cn('h-8 w-8 rounded-md ring-1 flex items-center justify-center', ring)}>
          <Icon className={cn('h-4 w-4', accent)} />
        </div>
        <h3 className="heading-md">{title}</h3>
      </div>
      {items.length === 0 ? (
        <p className="text-sm text-muted">None detected for this run.</p>
      ) : (
        <ul className="space-y-2">
          {items.map((s, i) => (
            <li key={i} className="flex items-start gap-2 text-sm text-ink/90 leading-relaxed">
              <span className={cn('mt-1.5 h-1.5 w-1.5 rounded-full shrink-0', accent.replace('text-', 'bg-'))} />
              <span>{s}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
