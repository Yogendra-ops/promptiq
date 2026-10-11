import React, { useMemo, useState, useEffect } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
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
  Check,
  FileText,
  Columns,
  ChevronDown,
  ArrowLeftRight,
  Trophy,
  CheckCircle2,
  Lightbulb,
  Edit3,
  Trash2,
  ClipboardPaste,
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
  type AIComparisonAnalysis,
} from '@/types';
import { cn, copyToClipboard, computeCounters, downloadAsFile, scoreLabel, scoreToColor, slugify, formatRelativeTime } from '@/lib/utils';
import { computeWordDiff, computeUnifiedDiffLines, type DiffChunk } from '@/lib/diff';
import type { OllamaError } from '@/services/ollamaService';

type ViewMode = 'split' | 'unified';
type CompareMode = 'improvement' | 'custom';
type CustomSource = 'manual' | 'library';

export default function Compare() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();

  const comparison = usePromptStore((s) => s.comparison);
  const evaluations = usePromptStore((s) => s.evaluations);
  const improvements = usePromptStore((s) => s.improvements);
  const prompts = usePromptStore((s) => s.prompts);
  const runEvaluate = usePromptStore((s) => s.runEvaluate);
  const runCompareAnalysis = usePromptStore((s) => s.runCompareAnalysis);
  const setComparison = usePromptStore((s) => s.setComparison);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const updatePrompt = usePromptStore((s) => s.updatePrompt);
  const pushToast = usePromptStore((s) => s.pushToast);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const selectedModel = usePromptStore((s) => s.settings.ollama.selectedModel);

  // Compare mode: Improvement (AI-driven) vs Custom (Prompt A vs Prompt B)
  const [compareMode, setCompareMode] = useState<CompareMode>('improvement');

  // Custom compare input source: manual typing vs library selection
  const [customSource, setCustomSource] = useState<CustomSource>('manual');

  // Manual drafting state for Custom Compare
  const [manualDraftA, setManualDraftA] = useState<{ title: string; content: string }>({
    title: 'Prompt A',
    content: '',
  });
  const [manualDraftB, setManualDraftB] = useState<{ title: string; content: string }>({
    title: 'Prompt B',
    content: '',
  });

  // Library prompt selection state
  const [customPromptAId, setCustomPromptAId] = useState<string>('');
  const [customPromptBId, setCustomPromptBId] = useState<string>('');

  // AI comparison analysis state
  const [aiAnalysis, setAiAnalysis] = useState<AIComparisonAnalysis | null>(null);
  const [analyzingAI, setAnalyzingAI] = useState<boolean>(false);

  // View state
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [highlightDiff, setHighlightDiff] = useState(true);
  const [loadingSide, setLoadingSide] = useState<'original' | 'improved' | 'both' | null>(null);
  const [error, setError] = useState<OllamaError | null>(null);

  // Dimensions list
  const dimensionsList = useMemo(
    () => Object.keys(DIMENSION_WEIGHTS) as EvaluationDimension[],
    []
  );

  // Resolve active improvement session (for Improvement mode)
  const targetImpId =
    searchParams.get('id') ??
    (location.state as any)?.improvementId ??
    comparison.improvement?.id ??
    null;

  const activeImprovement: ImprovementResult | null = useMemo(() => {
    if (targetImpId) {
      const found = improvements.find((i) => i.id === targetImpId);
      if (found) return found;
    }
    if (comparison.improvement) return comparison.improvement;
    return improvements[0] ?? null;
  }, [targetImpId, comparison.improvement, improvements]);

  // Sync active improvement to store and URL if needed
  useEffect(() => {
    if (activeImprovement && activeImprovement.id !== comparison.improvement?.id) {
      setComparison({ improvement: activeImprovement });
    }
  }, [activeImprovement, comparison.improvement?.id, setComparison]);

  // Handle library prompt selection in Custom Compare
  function handleSelectLibraryPrompt(side: 'A' | 'B', id: string) {
    if (side === 'A') {
      setCustomPromptAId(id);
      const p = prompts.find((x) => x.id === id);
      if (p) setManualDraftA({ title: p.title, content: p.content });
    } else {
      setCustomPromptBId(id);
      const p = prompts.find((x) => x.id === id);
      if (p) setManualDraftB({ title: p.title, content: p.content });
    }
    setAiAnalysis(null);
  }

  // Resolve Original (Prompt A) data
  const originalData = useMemo(() => {
    if (compareMode === 'custom') {
      const content = manualDraftA.content;
      const title = manualDraftA.title || 'Prompt A';
      const pId = customPromptAId || undefined;

      const matchingEval =
        (comparison.original && comparison.original.promptContent === content
          ? comparison.original
          : null) ??
        evaluations.find(
          (e) => (pId && e.promptId === pId) || e.promptContent === content
        ) ??
        null;

      return {
        title,
        content,
        model: matchingEval?.model,
        eval: matchingEval,
        promptId: pId,
      };
    }

    if (!activeImprovement) {
      if (comparison.original) {
        return {
          title: comparison.original.promptTitle,
          content: comparison.original.promptContent,
          model: comparison.original.model,
          eval: comparison.original,
          promptId: comparison.original.promptId,
        };
      }
      return null;
    }

    const content = activeImprovement.originalPromptContent;
    const title = activeImprovement.originalTitle;

    const matchingEval =
      (comparison.original && comparison.original.promptContent === content
        ? comparison.original
        : null) ??
      evaluations.find(
        (e) =>
          e.promptContent === content ||
          (activeImprovement.promptId && e.promptId === activeImprovement.promptId)
      ) ??
      null;

    return {
      title,
      content,
      model: matchingEval?.model,
      eval: matchingEval,
      promptId: activeImprovement.promptId,
    };
  }, [compareMode, manualDraftA, customPromptAId, evaluations, activeImprovement, comparison.original]);

  // Resolve Improved (Prompt B) data
  const improvedData = useMemo(() => {
    if (compareMode === 'custom') {
      const content = manualDraftB.content;
      const title = manualDraftB.title || 'Prompt B';
      const pId = customPromptBId || undefined;

      const matchingEval =
        (comparison.improved && comparison.improved.promptContent === content
          ? comparison.improved
          : null) ??
        evaluations.find(
          (e) => (pId && e.promptId === pId) || e.promptContent === content
        ) ??
        null;

      return {
        title,
        content,
        model: matchingEval?.model,
        eval: matchingEval,
        promptId: pId,
      };
    }

    if (!activeImprovement) return null;

    const content = activeImprovement.improvedPromptContent;
    const title = activeImprovement.improvedTitle;

    const matchingEval =
      (comparison.improved && comparison.improved.promptContent === content
        ? comparison.improved
        : null) ??
      evaluations.find((e) => e.promptContent === content) ??
      null;

    return {
      title,
      content,
      model: matchingEval?.model ?? activeImprovement.model,
      eval: matchingEval,
      promptId: undefined,
    };
  }, [compareMode, manualDraftB, customPromptBId, evaluations, activeImprovement, comparison.improved]);

  // Dual evaluation handler
  async function handleEvaluate(which: 'original' | 'improved' | 'both'): Promise<{ orig?: EvaluationResult; imp?: EvaluationResult }> {
    setError(null);
    setLoadingSide(which);

    let resOrig: EvaluationResult | undefined;
    let resImp: EvaluationResult | undefined;

    try {
      if (which === 'original' || which === 'both') {
        if (!originalData?.content.trim()) throw new Error('Prompt A content is empty');
        resOrig = await runEvaluate({
          title: originalData.title || 'Prompt A',
          content: originalData.content,
          promptId: originalData.promptId,
        });
        setComparison({ original: resOrig });
        pushToast({
          type: 'success',
          title: `${compareMode === 'custom' ? 'Prompt A' : 'Original'} evaluated`,
          description: `Score: ${resOrig.overallScore.toFixed(1)}/10 (${scoreLabel(resOrig.overallScore)})`,
        });
      }

      if (which === 'improved' || which === 'both') {
        if (!improvedData?.content.trim()) throw new Error('Prompt B content is empty');
        resImp = await runEvaluate({
          title: improvedData.title || 'Prompt B',
          content: improvedData.content,
          promptId: improvedData.promptId,
        });
        setComparison({ improved: resImp });
        pushToast({
          type: 'success',
          title: `${compareMode === 'custom' ? 'Prompt B' : 'Improved'} evaluated`,
          description: `Score: ${resImp.overallScore.toFixed(1)}/10 (${scoreLabel(resImp.overallScore)})`,
        });
      }

      return { orig: resOrig, imp: resImp };
    } catch (e: any) {
      setError(e as OllamaError);
      pushToast({
        type: 'error',
        title: 'Evaluation failed',
        description: e?.message ?? 'Unknown error occurred',
      });
      return {};
    } finally {
      setLoadingSide(null);
    }
  }

  // AI-assisted comparison (evaluates both + generates AI verdict & recommendations)
  async function handleCompareWithAI() {
    if (!originalData?.content.trim() || !improvedData?.content.trim()) {
      pushToast({
        type: 'error',
        title: 'Both prompts required',
        description: 'Please provide content for both Prompt A and Prompt B before comparing with AI.',
      });
      return;
    }

    setAnalyzingAI(true);
    setError(null);

    try {
      // 1. Evaluate prompts if scores are not yet computed
      if (!originalData.eval || !improvedData.eval) {
        await handleEvaluate('both');
      }

      // 2. Run AI Comparative Analysis
      const analysis = await runCompareAnalysis({
        promptA: { title: originalData.title, content: originalData.content },
        promptB: { title: improvedData.title, content: improvedData.content },
      });

      setAiAnalysis(analysis);
      pushToast({
        type: 'success',
        title: 'AI Comparison Ready',
        description: `Analysis complete: ${analysis.winner === 'tie' ? 'Comparable quality' : (analysis.winner === 'A' ? analysis.promptATitle : analysis.promptBTitle) + ' recommended'}`,
      });
    } catch (e: any) {
      setError(e as OllamaError);
      pushToast({
        type: 'error',
        title: 'AI Comparison Failed',
        description: e?.message ?? 'Could not generate comparison analysis',
      });
    } finally {
      setAnalyzingAI(false);
    }
  }

  // Save prompt handler
  function handleSavePrompt(which: 'A' | 'B', asNew = true) {
    const data = which === 'A' ? originalData : improvedData;
    if (!data || !data.content.trim()) return;

    const score = data.eval?.overallScore;
    if (!asNew && data.promptId) {
      updatePrompt(data.promptId, {
        title: data.title,
        content: data.content,
        lastScore: score,
      });
      pushToast({
        type: 'success',
        title: 'Prompt updated',
        description: `Updated "${data.title}" in library`,
      });
    } else {
      const saved = upsertPrompt({
        title: data.title || (which === 'A' ? 'Prompt A' : 'Prompt B'),
        content: data.content,
        category: 'General',
        tags: [which === 'A' ? 'candidate-a' : 'candidate-b'],
        lastScore: score,
      });
      if (which === 'A') setCustomPromptAId(saved.id);
      else setCustomPromptBId(saved.id);
      pushToast({
        type: 'success',
        title: 'Saved to Library',
        description: `Added "${saved.title}" to library`,
      });
    }
  }

  // Copy helpers
  async function copyContent(text: string, label: string) {
    const ok = await copyToClipboard(text);
    pushToast({
      type: ok ? 'success' : 'error',
      title: ok ? `${label} copied` : 'Copy failed',
    });
  }

  async function copyMarkdownComparison() {
    if (!originalData && !improvedData) return;
    const origScore = originalData?.eval ? `${originalData.eval.overallScore.toFixed(1)}/10` : 'Not evaluated';
    const impScore = improvedData?.eval ? `${improvedData.eval.overallScore.toFixed(1)}/10` : 'Not evaluated';
    const origStats = computeCounters(originalData?.content ?? '');
    const impStats = computeCounters(improvedData?.content ?? '');

    const lines: string[] = [
      `# Prompt Comparison: ${originalData?.title ?? 'Prompt A'} vs. ${improvedData?.title ?? 'Prompt B'}`,
      `*Generated with PromptIQ on ${new Date().toLocaleDateString()}*`,
      '',
      '## Score & Metrics Overview',
      '| Metric | ' + (compareMode === 'custom' ? originalData?.title ?? 'Prompt A' : 'Original') + ' | ' + (compareMode === 'custom' ? improvedData?.title ?? 'Prompt B' : 'Improved') + ' | Delta |',
      '| :--- | :--- | :--- | :--- |',
      `| Overall Score | ${origScore} | ${impScore} | ${delta !== null ? (delta >= 0 ? '+' : '') + delta.toFixed(1) : '—'} |`,
      `| Words | ${origStats.words} | ${impStats.words} | ${impStats.words - origStats.words >= 0 ? '+' : ''}${impStats.words - origStats.words} |`,
      `| Est. Tokens | ${origStats.estimatedTokens} | ${impStats.estimatedTokens} | ${impStats.estimatedTokens - origStats.estimatedTokens >= 0 ? '+' : ''}${impStats.estimatedTokens - origStats.estimatedTokens} |`,
      '',
    ];

    if (aiAnalysis) {
      lines.push(
        '## AI Comparison Verdict',
        `**Winner:** ${aiAnalysis.winner === 'tie' ? 'Comparable Quality' : aiAnalysis.winner === 'A' ? aiAnalysis.promptATitle : aiAnalysis.promptBTitle}`,
        '',
        aiAnalysis.verdict,
        '',
        '### Key Differences',
        ...aiAnalysis.keyDifferences.map((d) => `- ${d}`),
        '',
        `### Strengths of ${aiAnalysis.promptATitle}`,
        ...aiAnalysis.promptAStrengths.map((s) => `- ${s}`),
        '',
        `### Strengths of ${aiAnalysis.promptBTitle}`,
        ...aiAnalysis.promptBStrengths.map((s) => `- ${s}`),
        '',
        '### Synthesis Recommendation',
        aiAnalysis.synthesisRecommendation,
        ''
      );
    } else if (activeImprovement?.rationale) {
      lines.push('## Improvement Rationale', activeImprovement.rationale, '');
      if (activeImprovement?.changes && activeImprovement.changes.length > 0) {
        lines.push('## Structural Changes');
        activeImprovement.changes.forEach((c, idx) => lines.push(`${idx + 1}. ${c}`));
        lines.push('');
      }
    }

    lines.push(
      `## ${compareMode === 'custom' ? originalData?.title ?? 'Prompt A' : 'Original Prompt'}`,
      '```',
      originalData?.content ?? '',
      '```',
      '',
      `## ${compareMode === 'custom' ? improvedData?.title ?? 'Prompt B' : 'Improved Prompt'}`,
      '```',
      improvedData?.content ?? '',
      '```'
    );

    const ok = await copyToClipboard(lines.join('\n'));
    pushToast({
      type: ok ? 'success' : 'error',
      title: ok ? 'Markdown report copied' : 'Copy failed',
      description: ok ? 'Ready to paste into GitHub, Jira, or notes' : undefined,
    });
  }

  // Export JSON
  function exportJSON() {
    if (!originalData && !improvedData) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      mode: compareMode,
      original: {
        title: originalData?.title ?? null,
        content: originalData?.content ?? null,
        evaluation: originalData?.eval ?? null,
      },
      improved: {
        title: improvedData?.title ?? null,
        content: improvedData?.content ?? null,
        evaluation: improvedData?.eval ?? null,
      },
      delta: {
        overall: delta,
        perDimension:
          originalData?.eval && improvedData?.eval
            ? dimensionsList.reduce((acc, dim) => {
                const a = originalData.eval!.dimensions[dim].score;
                const b = improvedData.eval!.dimensions[dim].score;
                acc[dim] = Math.round((b - a) * 10) / 10;
                return acc;
              }, {} as Record<string, number>)
            : null,
      },
      aiAnalysis: aiAnalysis ?? null,
      improvementDetails: activeImprovement
        ? {
            changes: activeImprovement.changes,
            rationale: activeImprovement.rationale,
            model: activeImprovement.model,
          }
        : null,
    };
    const name = slugify(originalData?.title ?? improvedData?.title ?? 'comparison');
    downloadAsFile(`${name}-comparison.json`, JSON.stringify(payload, null, 2), 'application/json');
    pushToast({ type: 'success', title: 'Exported comparison JSON' });
  }

  // Navigate to Lab with prompt content
  function editInLab(which: 'original' | 'improved') {
    const data = which === 'original' ? originalData : improvedData;
    if (!data) return;
    const saved = upsertPrompt({
      title: data.title || 'Untitled Prompt',
      content: data.content,
      category: 'General',
    });
    navigate(`/lab?prompt=${saved.id}`);
  }

  // Compute overall delta accurately
  const delta =
    originalData?.eval && improvedData?.eval
      ? Math.round((improvedData.eval.overallScore - originalData.eval.overallScore) * 10) / 10
      : null;

  const hasContent = Boolean(originalData?.content.trim() || improvedData?.content.trim());

  // Compute diff chunks for highlighting
  const wordDiffChunks = useMemo(() => {
    if (!highlightDiff || !originalData?.content || !improvedData?.content) return null;
    return computeWordDiff(originalData.content, improvedData.content);
  }, [highlightDiff, originalData?.content, improvedData?.content]);

  // Compute unified diff lines
  const unifiedDiffLines = useMemo(() => {
    if (!originalData?.content || !improvedData?.content) return [];
    return computeUnifiedDiffLines(originalData.content, improvedData.content);
  }, [originalData?.content, improvedData?.content]);

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Comparison"
        title="Side-by-side prompt analysis."
        subtitle="Compare revisions or type custom prompts to evaluate score deltas, inspect word diffs, and get AI synthesis recommendations."
        actions={
          <div className="flex items-center gap-2 flex-wrap">
            {hasContent && (
              <>
                <button
                  className="btn-secondary"
                  onClick={copyMarkdownComparison}
                  title="Copy full comparison as Markdown table and code blocks"
                  aria-label="Copy markdown comparison"
                >
                  <FileText className="h-4 w-4" />
                  <span className="hidden sm:inline">Copy</span> Markdown
                </button>
                <button
                  className="btn-secondary"
                  onClick={exportJSON}
                  title="Export comparison and scores as JSON"
                  aria-label="Export JSON"
                >
                  <FileDown className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span> JSON
                </button>
              </>
            )}

            {/* Compare with AI Button (for Custom mode) */}
            {compareMode === 'custom' && (
              <button
                className="btn-primary"
                disabled={!originalData?.content.trim() || !improvedData?.content.trim() || loadingSide !== null || analyzingAI}
                onClick={handleCompareWithAI}
                title="Evaluate both prompts and generate an AI comparison verdict"
              >
                {analyzingAI || loadingSide === 'both' ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Analyzing with AI…
                  </span>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4" />
                    Compare with AI
                  </>
                )}
              </button>
            )}

            {/* Quick evaluation trigger (for Improvement mode) */}
            {compareMode === 'improvement' && !improvedData?.eval && improvedData?.content && (
              <button
                className="btn-primary"
                disabled={loadingSide !== null}
                onClick={() => handleEvaluate('improved')}
              >
                {loadingSide === 'improved' || loadingSide === 'both' ? (
                  <span className="inline-flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Evaluating Improved…
                  </span>
                ) : (
                  <>
                    <Shuffle className="h-4 w-4" />
                    Evaluate Improved
                  </>
                )}
              </button>
            )}
          </div>
        }
      />

      {/* Mode Switcher & Session Selector Bar */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-2.5 rounded-lg border border-border">
        <div className="flex items-center gap-1.5 p-1 bg-border-light rounded-md border border-border">
          <button
            onClick={() => setCompareMode('improvement')}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors',
              compareMode === 'improvement'
                ? 'bg-white text-ink shadow-sm font-semibold'
                : 'text-muted hover:text-ink'
            )}
          >
            Improvement Review
          </button>
          <button
            onClick={() => {
              setCompareMode('custom');
              if (customSource === 'library') {
                if (!customPromptAId && prompts[0]) handleSelectLibraryPrompt('A', prompts[0].id);
                if (!customPromptBId && prompts[1]) handleSelectLibraryPrompt('B', prompts[1].id);
              }
            }}
            className={cn(
              'px-3 py-1.5 text-xs font-medium rounded transition-colors',
              compareMode === 'custom'
                ? 'bg-white text-ink shadow-sm font-semibold'
                : 'text-muted hover:text-ink'
            )}
          >
            Custom Compare (A vs. B)
          </button>
        </div>

        {compareMode === 'improvement' && improvements.length > 1 && (
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-muted font-medium shrink-0">Revision:</span>
            <div className="relative flex-1 sm:w-64">
              <select
                className="input !py-1 !text-xs !pr-8 w-full truncate appearance-none"
                value={activeImprovement?.id ?? ''}
                onChange={(e) => {
                  const sel = improvements.find((i) => i.id === e.target.value);
                  if (sel) {
                    setComparison({ improvement: sel });
                    setSearchParams({ id: sel.id });
                  }
                }}
                aria-label="Select improvement session"
              >
                {improvements.map((imp) => (
                  <option key={imp.id} value={imp.id}>
                    {imp.originalTitle || 'Untitled'} → {imp.improvedTitle || 'Improved'} (
                    {formatRelativeTime(imp.createdAt)})
                  </option>
                ))}
              </select>
              <ChevronDown className="h-3.5 w-3.5 text-muted absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
            </div>
          </div>
        )}

        {compareMode === 'custom' && (
          <div className="flex items-center gap-3 flex-wrap w-full sm:w-auto">
            <div className="flex items-center gap-1.5 p-0.5 bg-border-light rounded border border-border">
              <button
                onClick={() => setCustomSource('manual')}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                  customSource === 'manual'
                    ? 'bg-white text-ink shadow-sm font-semibold'
                    : 'text-muted hover:text-ink'
                )}
              >
                Type Manually
              </button>
              <button
                onClick={() => {
                  setCustomSource('library');
                  if (!customPromptAId && prompts[0]) handleSelectLibraryPrompt('A', prompts[0].id);
                  if (!customPromptBId && prompts[1]) handleSelectLibraryPrompt('B', prompts[1].id);
                }}
                className={cn(
                  'px-2.5 py-1 text-[11px] font-medium rounded transition-colors',
                  customSource === 'library'
                    ? 'bg-white text-ink shadow-sm font-semibold'
                    : 'text-muted hover:text-ink'
                )}
              >
                Select from Library
              </button>
            </div>

            {customSource === 'library' && (
              <div className="flex items-center gap-2 flex-wrap">
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-muted">A:</span>
                  <select
                    className="input !py-1 !text-xs max-w-[140px] truncate"
                    value={customPromptAId}
                    onChange={(e) => handleSelectLibraryPrompt('A', e.target.value)}
                    aria-label="Select Prompt A"
                  >
                    <option value="">Select prompt…</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
                <ArrowLeftRight className="h-3.5 w-3.5 text-muted shrink-0" />
                <div className="flex items-center gap-1.5 text-xs">
                  <span className="font-medium text-muted">B:</span>
                  <select
                    className="input !py-1 !text-xs max-w-[140px] truncate"
                    value={customPromptBId}
                    onChange={(e) => handleSelectLibraryPrompt('B', e.target.value)}
                    aria-label="Select Prompt B"
                  >
                    <option value="">Select prompt…</option>
                    {prompts.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {!hasContent && compareMode !== 'custom' ? (
        <EmptyCompareState
          onGoEvaluator={() => navigate('/evaluator')}
          onGoLab={() => navigate('/lab')}
          onGoSettings={() => navigate('/settings')}
          liveSetupMissing={!demoMode && !selectedModel}
        />
      ) : (
        <>
          {/* Error Banner */}
          {error && (
            <div className="card p-5 border-l-[3px] border-l-score-poor space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-5 w-5 text-score-poor shrink-0 mt-0.5" />
                <div className="flex-1">
                  <div className="text-sm font-semibold text-ink">
                    {error.type === 'timeout'
                      ? 'Request timed out while evaluating'
                      : error.type === 'network'
                        ? 'Unable to reach Ollama'
                        : error.type === 'validation'
                          ? 'Configuration required'
                          : 'Failed to run evaluation'}
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
                <button
                  className="btn-secondary"
                  onClick={() => handleEvaluate(loadingSide || 'both')}
                  disabled={loadingSide !== null || analyzingAI}
                >
                  {loadingSide !== null ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Shuffle className="h-4 w-4" />
                  )}
                  Retry
                </button>
                <button className="btn-secondary" onClick={() => navigate('/settings')}>
                  Open Settings
                </button>
              </div>
            </div>
          )}

          {/* Tri-Card Score & Delta Overview */}
          <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <ScoreCard
              label={compareMode === 'improvement' ? 'Original Baseline' : originalData?.title || 'Prompt A Score'}
              score={originalData?.eval?.overallScore}
              side="left"
              onEvaluate={() => handleEvaluate('original')}
              isLoading={loadingSide === 'original' || loadingSide === 'both'}
              hasContent={Boolean(originalData?.content.trim())}
            />

            <DeltaCard
              delta={delta}
              hasOriginal={Boolean(originalData?.eval)}
              hasImproved={Boolean(improvedData?.eval)}
              isLoading={loadingSide !== null || analyzingAI}
              onEvaluateOriginal={() => handleEvaluate('original')}
              onEvaluateImproved={() => handleEvaluate('improved')}
              onEvaluateBoth={() => (compareMode === 'custom' ? handleCompareWithAI() : handleEvaluate('both'))}
              customLabel={compareMode === 'custom' ? 'Compare with AI' : undefined}
            />

            <ScoreCard
              label={compareMode === 'improvement' ? 'Improved Score' : improvedData?.title || 'Prompt B Score'}
              score={improvedData?.eval?.overallScore}
              side="right"
              emptyLabel={!improvedData?.content.trim() ? 'No content' : 'Not yet evaluated'}
              onEvaluate={() => handleEvaluate('improved')}
              isLoading={loadingSide === 'improved' || loadingSide === 'both'}
              hasContent={Boolean(improvedData?.content.trim())}
            />
          </section>

          {/* AI Comparison Verdict & Synthesis Card (When Available in Custom Mode) */}
          {compareMode === 'custom' && aiAnalysis && (
            <section className="card p-6 space-y-5 border-accent/30 bg-accent/[0.015]">
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                  <div className="section-title mb-1.5 flex items-center gap-1.5 text-accent">
                    <Sparkles className="h-3.5 w-3.5" />
                    AI Comparison Analysis
                  </div>
                  <h3 className="heading-md">Comparative verdict & recommendation</h3>
                </div>
                <div className="flex items-center gap-2">
                  <span
                    className={cn(
                      'chip font-semibold !h-7 !px-3',
                      aiAnalysis.winner === 'A'
                        ? 'border-accent/40 bg-accent/10 text-accent'
                        : aiAnalysis.winner === 'B'
                          ? 'border-score-excellent/40 bg-score-excellent/10 text-score-excellent'
                          : 'border-border bg-border-light text-ink'
                    )}
                  >
                    <Trophy className="h-3.5 w-3.5 mr-1 inline" />
                    {aiAnalysis.winner === 'tie'
                      ? 'Balanced / Comparable Quality'
                      : aiAnalysis.winner === 'A'
                        ? `${aiAnalysis.promptATitle} Recommended`
                        : `${aiAnalysis.promptBTitle} Recommended`}
                  </span>
                  {aiAnalysis.isDemo && <span className="chip-accent !h-5 !text-[10px]">Demo</span>}
                </div>
              </div>

              {/* Verdict Summary Box */}
              <div className="bg-white p-4 rounded-lg border border-border shadow-xs">
                <div className="text-sm text-ink leading-relaxed font-medium">
                  {aiAnalysis.verdict}
                </div>
              </div>

              {/* Comparative Strengths Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="p-4 rounded-lg border border-border bg-white">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-accent" />
                    Strengths of {aiAnalysis.promptATitle}
                  </div>
                  <ul className="space-y-2">
                    {aiAnalysis.promptAStrengths.map((s, idx) => (
                      <li key={idx} className="text-xs text-ink/90 flex items-start gap-2 leading-relaxed">
                        <span className="text-accent shrink-0 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="p-4 rounded-lg border border-border bg-white">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted mb-2.5 flex items-center gap-1.5">
                    <CheckCircle2 className="h-3.5 w-3.5 text-score-excellent" />
                    Strengths of {aiAnalysis.promptBTitle}
                  </div>
                  <ul className="space-y-2">
                    {aiAnalysis.promptBStrengths.map((s, idx) => (
                      <li key={idx} className="text-xs text-ink/90 flex items-start gap-2 leading-relaxed">
                        <span className="text-score-excellent shrink-0 mt-0.5">•</span>
                        <span>{s}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              {/* Key Differences */}
              {aiAnalysis.keyDifferences.length > 0 && (
                <div className="space-y-2 pt-1">
                  <div className="text-xs font-semibold uppercase tracking-wider text-muted">
                    Key Distinctions & Structural Edits
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                    {aiAnalysis.keyDifferences.map((d, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-ink/80 bg-white p-2.5 rounded border border-border-light">
                        <span className="h-4 w-4 rounded-full bg-border-light text-muted flex items-center justify-center shrink-0 text-[10px] font-semibold mt-0.5">
                          {i + 1}
                        </span>
                        <span>{d}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Synthesis Tip */}
              <div className="p-3.5 rounded-lg border border-border bg-border-light/40 flex items-start gap-2.5">
                <Lightbulb className="h-4 w-4 text-score-good shrink-0 mt-0.5" />
                <div className="text-xs text-ink/80 leading-relaxed">
                  <span className="font-semibold text-ink">Synthesis Recommendation: </span>
                  {aiAnalysis.synthesisRecommendation}
                </div>
              </div>
            </section>
          )}

          {/* Prompt Comparison Container with View Toggles */}
          <div className="card overflow-hidden">
            <div className="flex items-center justify-between px-6 py-3 border-b border-border bg-border-light/30 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">
                  View Mode:
                </span>
                <div className="inline-flex rounded-md border border-border bg-white p-0.5">
                  <button
                    onClick={() => setViewMode('split')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors',
                      viewMode === 'split' ? 'bg-border-light text-ink font-semibold' : 'text-muted hover:text-ink'
                    )}
                    aria-label="Split side-by-side view"
                  >
                    <Columns className="h-3.5 w-3.5" />
                    Side-by-Side
                  </button>
                  <button
                    onClick={() => setViewMode('unified')}
                    className={cn(
                      'px-2.5 py-1 text-xs font-medium rounded flex items-center gap-1.5 transition-colors',
                      viewMode === 'unified' ? 'bg-border-light text-ink font-semibold' : 'text-muted hover:text-ink'
                    )}
                    aria-label="Unified diff view"
                  >
                    <GitCompare className="h-3.5 w-3.5" />
                    Unified Diff
                  </button>
                </div>
              </div>

              {viewMode === 'split' && originalData?.content && improvedData?.content && (
                <label className="flex items-center gap-1.5 text-xs text-muted cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={highlightDiff}
                    onChange={(e) => setHighlightDiff(e.target.checked)}
                    className="rounded border-border text-accent focus:ring-accent h-3.5 w-3.5"
                  />
                  <span>Highlight word differences</span>
                </label>
              )}
            </div>

            {viewMode === 'split' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-border">
                <PromptPanel
                  side={compareMode === 'improvement' ? 'Original' : 'Prompt A'}
                  title={originalData?.title ?? 'Prompt A'}
                  model={originalData?.model}
                  score={originalData?.eval?.overallScore}
                  content={originalData?.content ?? ''}
                  diffChunks={highlightDiff && wordDiffChunks ? wordDiffChunks.filter((c) => c.type !== 'add') : null}
                  diffSide="original"
                  accent="left"
                  editable={compareMode === 'custom' && customSource === 'manual'}
                  onTitleChange={(v) => {
                    setManualDraftA((prev) => ({ ...prev, title: v }));
                    setAiAnalysis(null);
                  }}
                  onContentChange={(v) => {
                    setManualDraftA((prev) => ({ ...prev, content: v }));
                    setAiAnalysis(null);
                  }}
                  onClear={() => {
                    setManualDraftA({ title: 'Prompt A', content: '' });
                    setAiAnalysis(null);
                  }}
                  onCopy={() => copyContent(originalData?.content ?? '', originalData?.title || 'Prompt A')}
                  onEdit={() => editInLab('original')}
                  onSave={() => handleSavePrompt('A', true)}
                />

                <PromptPanel
                  side={compareMode === 'improvement' ? 'Improved' : 'Prompt B'}
                  title={improvedData?.title ?? (compareMode === 'custom' ? 'Prompt B' : 'Improved version')}
                  model={improvedData?.model}
                  score={improvedData?.eval?.overallScore}
                  content={improvedData?.content ?? ''}
                  diffChunks={highlightDiff && wordDiffChunks ? wordDiffChunks.filter((c) => c.type !== 'remove') : null}
                  diffSide="improved"
                  accent="right"
                  editable={compareMode === 'custom' && customSource === 'manual'}
                  onTitleChange={(v) => {
                    setManualDraftB((prev) => ({ ...prev, title: v }));
                    setAiAnalysis(null);
                  }}
                  onContentChange={(v) => {
                    setManualDraftB((prev) => ({ ...prev, content: v }));
                    setAiAnalysis(null);
                  }}
                  onClear={() => {
                    setManualDraftB({ title: 'Prompt B', content: '' });
                    setAiAnalysis(null);
                  }}
                  onCopy={() => copyContent(improvedData?.content ?? '', improvedData?.title || 'Prompt B')}
                  onEdit={() => editInLab('improved')}
                  onSave={() => handleSavePrompt('B', true)}
                  canUpdateOriginal={compareMode === 'improvement' && Boolean(originalData?.promptId)}
                  onUpdateOriginal={() => handleSavePrompt('B', false)}
                  emptyHint={
                    !improvedData?.content
                      ? compareMode === 'custom'
                        ? 'Type or paste Prompt B here to compare with Prompt A.'
                        : 'Improve a prompt in Evaluator or Lab to compare it here.'
                      : undefined
                  }
                  badge={
                    activeImprovement?.isDemo ? (
                      <span className="chip-accent !h-5">Demo</span>
                    ) : undefined
                  }
                />
              </div>
            ) : (
              /* Unified Diff View */
              <div className="p-6">
                <div className="rounded-lg border border-border bg-[#FDFDFD] font-mono text-[13px] leading-relaxed overflow-x-auto p-4 space-y-0.5 max-h-[560px] overflow-y-auto scrollbar-thin">
                  {unifiedDiffLines.map((line, idx) => (
                    <div
                      key={idx}
                      className={cn(
                        'px-2 py-0.5 rounded flex items-start gap-2',
                        line.type === 'add'
                          ? 'bg-emerald-50 text-emerald-900 border-l-2 border-emerald-500'
                          : line.type === 'remove'
                            ? 'bg-rose-50 text-rose-900 border-l-2 border-rose-500'
                            : 'text-ink/80'
                      )}
                    >
                      <span className="select-none font-bold shrink-0 w-4 text-center">
                        {line.type === 'add' ? '+' : line.type === 'remove' ? '-' : ' '}
                      </span>
                      <span className="whitespace-pre-wrap break-words flex-1">
                        {line.content || ' '}
                      </span>
                    </div>
                  ))}
                  {unifiedDiffLines.length === 0 && (
                    <div className="py-8 text-center text-muted font-sans text-sm">
                      Both prompts are identical. No differences found.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Per-Dimension Changes Matrix (when both sides have evaluated scores) */}
          {originalData?.eval && improvedData?.eval && (
            <section className="card p-6">
              <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
                <div>
                  <div className="section-title mb-1.5">Per-Dimension Breakdown</div>
                  <h3 className="heading-md">Dimension score deltas</h3>
                </div>
                <div className="text-xs text-muted flex items-center gap-3">
                  <span className="inline-flex items-center gap-1 font-medium text-score-excellent">
                    <Plus className="h-3 w-3" /> gain
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-score-poor">
                    <Minus className="h-3 w-3" /> loss
                  </span>
                  <span className="inline-flex items-center gap-1 font-medium text-muted">
                    <Equal className="h-3 w-3" /> no change
                  </span>
                </div>
              </div>
              <div className="divide-y divide-border-light">
                {dimensionsList.map((dim) => {
                  const a = originalData.eval!.dimensions[dim];
                  const b = improvedData.eval!.dimensions[dim];
                  const d = Math.round((b.score - a.score) * 10) / 10;
                  return (
                    <div key={dim} className="py-2.5 grid grid-cols-12 gap-4 items-center">
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
                          label={compareMode === 'improvement' ? 'Original' : originalData?.title || 'Prompt A'}
                        />
                      </div>
                      <div className="col-span-6 lg:col-span-4">
                        <ScoreMeter
                          compact
                          score={b.score}
                          label={compareMode === 'improvement' ? 'Improved' : improvedData?.title || 'Prompt B'}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}

          {/* Word, Token & Character Counters */}
          <section className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="card p-5">
              <h3 className="heading-md mb-3">
                {compareMode === 'improvement' ? 'Original Stats' : originalData?.title || 'Prompt A Stats'}
              </h3>
              <PromptCounters content={originalData?.content ?? ''} />
            </div>
            <div className="card p-5">
              <div className="flex items-center justify-between mb-3">
                <h3 className="heading-md">
                  {compareMode === 'improvement' ? 'Improved Stats' : improvedData?.title || 'Prompt B Stats'}
                </h3>
                {originalData?.content && improvedData?.content && (
                  <DeltaChip
                    original={computeCounters(originalData.content)}
                    improved={computeCounters(improvedData.content)}
                  />
                )}
              </div>
              <PromptCounters content={improvedData?.content ?? ''} />
            </div>
          </section>

          {/* Structural Changes (for Improvement mode) */}
          {compareMode === 'improvement' && activeImprovement && (
            <section className="card p-6 space-y-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="section-title mb-1.5">Structural Modifications</div>
                  <h3 className="heading-md">What the improvement changed</h3>
                  <p className="mt-2 text-sm text-muted max-w-2xl leading-relaxed">
                    {activeImprovement.rationale}
                  </p>
                </div>
                {improvedData?.eval && (
                  <div className="hidden md:block">
                    <OverallScoreBadge score={improvedData.eval.overallScore} size="sm" />
                  </div>
                )}
              </div>
              {activeImprovement.changes && activeImprovement.changes.length > 0 ? (
                <ul className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2.5">
                  {activeImprovement.changes.map((c, i) => (
                    <li key={i} className="flex items-start gap-2.5 text-sm text-ink/90 leading-relaxed">
                      <span className="mt-0.5 h-5 w-5 shrink-0 rounded-md bg-accent/10 text-accent flex items-center justify-center text-[11px] font-semibold">
                        {i + 1}
                      </span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-sm text-muted">No change-list recorded for this revision.</p>
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
  emptyLabel,
  onEvaluate,
  isLoading,
  hasContent,
}: {
  label: string;
  score?: number;
  side: 'left' | 'right';
  emptyLabel?: string;
  onEvaluate?: () => void;
  isLoading?: boolean;
  hasContent?: boolean;
}) {
  return (
    <div className="card p-5">
      <div className="flex items-center justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="section-title truncate">{label}</div>
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
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-muted">{emptyLabel ?? 'Not evaluated'}</span>
                {hasContent && onEvaluate && (
                  <button
                    onClick={onEvaluate}
                    disabled={isLoading}
                    className="text-xs font-semibold text-accent hover:underline flex items-center gap-1 disabled:opacity-50"
                  >
                    {isLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shuffle className="h-3 w-3" />}
                    Evaluate
                  </button>
                )}
              </div>
            </>
          )}
        </div>
        {typeof score === 'number' && (
          <div className="hidden sm:block shrink-0">
            <OverallScoreBadge score={score} size="sm" />
          </div>
        )}
      </div>
    </div>
  );
}

function DeltaCard({
  delta,
  hasOriginal,
  hasImproved,
  isLoading,
  onEvaluateOriginal,
  onEvaluateImproved,
  onEvaluateBoth,
  customLabel,
}: {
  delta: number | null;
  hasOriginal: boolean;
  hasImproved: boolean;
  isLoading: boolean;
  onEvaluateOriginal: () => void;
  onEvaluateImproved: () => void;
  onEvaluateBoth: () => void;
  customLabel?: string;
}) {
  // Case 1: Both evaluated
  if (hasOriginal && hasImproved && delta !== null) {
    const positive = delta > 0;
    const neutral = delta === 0;
    return (
      <div
        className={cn(
          'card p-5 relative z-10 md:shadow-card-hover border-accent/30',
          neutral ? 'border-border' : positive ? 'border-score-excellent/30' : 'border-score-poor/30'
        )}
      >
        <div className="section-title">Score Delta</div>
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
          <span className="text-sm text-muted">points overall</span>
        </div>
        <div className="text-xs mt-0.5 text-ink/70">
          {positive ? 'Net improvement over baseline' : neutral ? 'Identical score' : 'Lower score than baseline'}
        </div>
      </div>
    );
  }

  // Case 2: Only original evaluated
  if (hasOriginal && !hasImproved) {
    return (
      <button
        onClick={onEvaluateImproved}
        disabled={isLoading}
        aria-label="Evaluate candidate B to calculate delta"
        className="card p-5 text-left hover:shadow-card-hover border-accent/30 transition-shadow relative z-10 group disabled:opacity-60"
      >
        <div className="section-title text-accent">Pending Evaluation</div>
        <div className="mt-1 text-2xl font-serif font-semibold text-ink flex items-center gap-2">
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-lg">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              Evaluating…
            </span>
          ) : (
            <>
              <span>Score Prompt B</span>
              <ArrowRight className="h-5 w-5 text-accent group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </div>
        <div className="text-xs mt-1 text-muted">Evaluate Prompt B to compute deltas and compare.</div>
      </button>
    );
  }

  // Case 3: Only improved evaluated
  if (!hasOriginal && hasImproved) {
    return (
      <button
        onClick={onEvaluateOriginal}
        disabled={isLoading}
        aria-label="Evaluate Prompt A"
        className="card p-5 text-left hover:shadow-card-hover border-accent/30 transition-shadow relative z-10 group disabled:opacity-60"
      >
        <div className="section-title text-accent">Pending Evaluation</div>
        <div className="mt-1 text-2xl font-serif font-semibold text-ink flex items-center gap-2">
          {isLoading ? (
            <span className="inline-flex items-center gap-2 text-lg">
              <Loader2 className="h-5 w-5 animate-spin text-accent" />
              Evaluating…
            </span>
          ) : (
            <>
              <span>Score Prompt A</span>
              <ArrowRight className="h-5 w-5 text-accent group-hover:translate-x-0.5 transition-transform" />
            </>
          )}
        </div>
        <div className="text-xs mt-1 text-muted">Evaluate Prompt A to compute deltas and compare.</div>
      </button>
    );
  }

  // Case 4: Neither evaluated
  return (
    <button
      onClick={onEvaluateBoth}
      disabled={isLoading}
      aria-label="Evaluate both prompts"
      className="card p-5 text-left hover:shadow-card-hover border-accent/30 transition-shadow relative z-10 group disabled:opacity-60"
    >
      <div className="section-title text-accent">Pending Evaluations</div>
      <div className="mt-1 text-2xl font-serif font-semibold text-ink flex items-center gap-2">
        {isLoading ? (
          <span className="inline-flex items-center gap-2 text-lg">
            <Loader2 className="h-5 w-5 animate-spin text-accent" />
            Evaluating both…
          </span>
        ) : (
          <>
            <span>{customLabel ?? 'Evaluate Both'}</span>
            <ArrowRight className="h-5 w-5 text-accent group-hover:translate-x-0.5 transition-transform" />
          </>
        )}
      </div>
      <div className="text-xs mt-1 text-muted">Score both prompts to generate a full comparison.</div>
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
  diffChunks,
  diffSide,
  editable,
  onTitleChange,
  onContentChange,
  onClear,
  onCopy,
  onEdit,
  onSave,
  canUpdateOriginal,
  onUpdateOriginal,
  emptyHint,
  badge,
}: {
  side: string;
  title: string;
  content: string;
  score?: number;
  model?: string;
  accent: 'left' | 'right';
  diffChunks?: DiffChunk[] | null;
  diffSide?: 'original' | 'improved';
  editable?: boolean;
  onTitleChange?: (val: string) => void;
  onContentChange?: (val: string) => void;
  onClear?: () => void;
  onCopy: () => void;
  onEdit: () => void;
  onSave: () => void;
  canUpdateOriginal?: boolean;
  onUpdateOriginal?: () => void;
  emptyHint?: string;
  badge?: React.ReactNode;
}) {
  const [isTyping, setIsTyping] = useState(editable ?? false);

  // Sync edit mode if editable prop changes
  useEffect(() => {
    if (editable) setIsTyping(true);
  }, [editable]);

  return (
    <div className="flex flex-col">
      <div
        className={cn(
          'flex items-center justify-between px-6 py-3 border-b border-border',
          accent === 'right' ? 'bg-accent/[0.03]' : 'bg-white'
        )}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          <span
            className={cn(
              'chip !py-0 !px-2 !h-6 text-[11px] font-semibold shrink-0',
              accent === 'right' ? '!border-accent/20 !bg-accent/10 !text-accent' : ''
            )}
          >
            {side}
          </span>
          {isTyping && onTitleChange ? (
            <input
              className="input !h-7 !py-0 !px-2 !text-xs font-semibold max-w-[200px] truncate"
              value={title}
              onChange={(e) => onTitleChange(e.target.value)}
              placeholder="Prompt title…"
              aria-label={`${side} title`}
            />
          ) : (
            <span className="text-sm font-semibold text-ink truncate">{title}</span>
          )}
          {badge}
        </div>

        <div className="flex items-center gap-1 shrink-0">
          {typeof score === 'number' && (
            <span className={cn('text-xs font-semibold tabular-nums mr-1.5', scoreToColor(score))}>
              {score.toFixed(1)}/10
            </span>
          )}

          {/* Toggle between typing and preview when editable */}
          {editable && onContentChange && (
            <button
              className={cn(
                'btn-ghost !p-1.5 h-7 text-xs font-medium px-2 flex items-center gap-1',
                isTyping ? 'text-accent bg-accent/10' : 'text-muted'
              )}
              title={isTyping ? 'Switch to formatted view' : 'Edit prompt text'}
              onClick={() => setIsTyping(!isTyping)}
              aria-label={isTyping ? 'Formatted view' : 'Edit prompt'}
            >
              <Edit3 className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{isTyping ? 'Done' : 'Edit'}</span>
            </button>
          )}

          {isTyping && onClear && content.length > 0 && (
            <button
              className="btn-ghost !p-1.5 h-7 w-7 text-muted hover:text-score-poor"
              title="Clear content"
              onClick={onClear}
              aria-label="Clear content"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            className="btn-ghost !p-1.5 h-7 w-7"
            title="Copy Prompt"
            onClick={onCopy}
            aria-label="Copy prompt"
          >
            <Copy className="h-3.5 w-3.5" />
          </button>

          <button
            className="btn-ghost !p-1.5 h-7 w-7"
            title={canUpdateOriginal ? 'Save as new prompt' : 'Save to Library'}
            onClick={onSave}
            aria-label="Save to library"
          >
            <Save className="h-3.5 w-3.5" />
          </button>

          {canUpdateOriginal && onUpdateOriginal && (
            <button
              className="btn-ghost !p-1.5 h-7 w-7 text-accent"
              title="Update original prompt in Library"
              onClick={onUpdateOriginal}
              aria-label="Update original prompt"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
          )}

          <button
            className="btn-ghost !p-1.5 h-7 w-7"
            title="Edit in Prompt Lab"
            onClick={onEdit}
            aria-label="Edit in Lab"
          >
            <FlaskConical className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="p-6 flex-1 min-h-[300px]">
        {isTyping && onContentChange ? (
          <textarea
            className="textarea w-full min-h-[280px] md:min-h-[420px] font-mono text-[13px] leading-relaxed resize-y"
            value={content}
            onChange={(e) => onContentChange(e.target.value)}
            placeholder={`Type or paste ${side} prompt text here to compare…`}
            spellCheck={false}
            aria-label={`${side} prompt content`}
          />
        ) : !content.trim() ? (
          <div className="h-full flex flex-col items-center justify-center text-center text-muted py-8 min-h-[260px]">
            <BookOpen className="h-8 w-8 mb-2 opacity-50" />
            <p className="text-sm max-w-xs">{emptyHint ?? 'No content to display.'}</p>
          </div>
        ) : diffChunks ? (
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90 scrollbar-thin max-h-[360px] md:max-h-[520px] overflow-y-auto">
            {diffChunks.map((chunk, i) => {
              if (chunk.type === 'remove' && diffSide === 'original') {
                return (
                  <mark key={i} className="bg-rose-100 text-rose-950 font-semibold px-0.5 rounded">
                    {chunk.value}
                  </mark>
                );
              }
              if (chunk.type === 'add' && diffSide === 'improved') {
                return (
                  <mark key={i} className="bg-emerald-100 text-emerald-950 font-semibold px-0.5 rounded">
                    {chunk.value}
                  </mark>
                );
              }
              return <span key={i}>{chunk.value}</span>;
            })}
          </pre>
        ) : (
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90 scrollbar-thin max-h-[360px] md:max-h-[520px] overflow-y-auto">
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
          {onGoSettings && (
            <button className="btn-secondary" onClick={onGoSettings}>
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
          Evaluate and improve a prompt in the Evaluator or Prompt Lab, or switch to Custom Compare
          above to type and compare any two prompts with AI assistance.
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
