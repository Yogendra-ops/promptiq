import type { OllamaModel, EvaluationDimension, DimensionScore, EvaluationResult, ImprovementResult, AIComparisonAnalysis } from '@/types';
import { uid, validateEvaluationDimensions, calculateWeightedScore } from '@/lib/utils';

export interface OllamaRequestOptions {
  baseUrl: string;
  timeoutMs?: number;
  signal?: AbortSignal;
}

export interface OllamaError {
  type: 'network' | 'cors' | 'timeout' | 'bad-response' | 'validation' | 'unknown';
  message: string;
  guidance?: string;
}

export function makeOllamaError(type: OllamaError['type'], message: string, guidance?: string): OllamaError {
  return { type, message, guidance };
}

function buildGuidanceForFailure(baseUrl: string): string {
  const isLocalhost = /localhost|127\.0\.0\.1/.test(baseUrl);
  const isHttps = typeof location !== 'undefined' && location.protocol === 'https:';
  const tips: string[] = [];
  tips.push('Verify Ollama is running locally and reachable at the configured URL.');
  tips.push('Run `ollama serve` or check the Ollama desktop app.');
  if (isLocalhost) {
    tips.push('Allow browser access to local HTTP endpoints — mixed-content blockers may prevent the page from reaching localhost.');
  }
  if (isHttps) {
    tips.push('HTTPS websites may be blocked from accessing a local HTTP Ollama server due to mixed-content policies; try running the app locally over HTTP.');
  }
  tips.push('Check browser DevTools (Network tab) and the Ollama logs for details.');
  tips.push('As a fallback, enable Demo Mode in Settings to view the full product experience without a live model.');
  return tips.join(' ');
}

async function safeFetch(input: string, init: RequestInit & { timeoutMs?: number }): Promise<Response> {
  const timeout = init.timeoutMs ?? 60_000;
  const userSignal = init.signal;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  const signals: AbortSignal[] = [controller.signal];
  if (userSignal) signals.push(userSignal);
  const combined = AbortSignal.any
    ? AbortSignal.any(signals)
    : controller.signal;
  try {
    const res = await fetch(input, { ...init, signal: combined });
    return res;
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      const expired = !userSignal?.aborted;
      throw expired
        ? makeOllamaError('timeout', `Request timed out after ${Math.round(timeout / 1000)}s.`, buildGuidanceForFailure(input))
        : makeOllamaError('network', 'Request cancelled by the user.', buildGuidanceForFailure(input));
    }
    throw makeOllamaError('network', `Unable to connect to Ollama: ${e?.message ?? 'Network failure'}.`, buildGuidanceForFailure(input));
  } finally {
    clearTimeout(timer);
  }
}

export async function testConnection(opts: OllamaRequestOptions): Promise<{ ok: boolean; error?: OllamaError }> {
  try {
    const res = await safeFetch(`${opts.baseUrl.replace(/\/$/, '')}/api/tags`, {
      method: 'GET',
      timeoutMs: opts.timeoutMs ?? 10_000,
    });
    if (res.ok) {
      return { ok: true };
    }
    const text = await res.text().catch(() => '');
    return {
      ok: false,
      error: makeOllamaError(
        'bad-response',
        `Ollama responded with HTTP ${res.status}${text ? `: ${text.slice(0, 200)}` : '.'}`,
        buildGuidanceForFailure(opts.baseUrl)
      ),
    };
  } catch (e) {
    return { ok: false, error: e as OllamaError };
  }
}

export async function listModels(opts: OllamaRequestOptions): Promise<OllamaModel[]> {
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/tags`;
  const res = await safeFetch(url, {
    method: 'GET',
    headers: { Accept: 'application/json' },
    timeoutMs: opts.timeoutMs,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeOllamaError(
      'bad-response',
      `Model discovery failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : '.'}`,
      buildGuidanceForFailure(opts.baseUrl)
    );
  }
  const json: any = await res.json().catch(() => null);
  if (!json || !Array.isArray(json.models)) return [];
  return json.models.map((m: any) => ({
    name: m.name ?? m.model ?? 'unknown',
    size: Number(m.size) ?? 0,
    modifiedAt: m.modified_at ?? new Date(0).toISOString(),
    digest: m.digest ?? '',
    details: m.details
      ? {
          family: String(m.details.family ?? ''),
          parameterSize: String(m.details.parameter_size ?? ''),
          quantizationLevel: String(m.details.quantization_level ?? ''),
        }
      : undefined,
  }));
}

const EVALUATION_SYSTEM_PROMPT = `You are PromptIQ, a prompt engineering auditor. Your job is to evaluate a user-provided prompt strictly on five weighted dimensions.

You must return ONLY valid JSON matching this shape. No preamble, no markdown, no commentary outside the JSON:
{
  "dimensions": {
    "clarity": { "score": 0-10, "feedback": "2-3 sentences of concrete, specific feedback on language clarity and ambiguity" },
    "context": { "score": 0-10, "feedback": "Feedback on whether the prompt provides enough situational context, background, and role framing" },
    "specificity": { "score": 0-10, "feedback": "Feedback on how concrete and scoped the task is, and whether vague language is used" },
    "constraints": { "score": 0-10, "feedback": "Feedback on whether explicit rules, limits, format constraints, and exclusions are listed" },
    "outputExpectations": { "score": 0-10, "feedback": "Feedback on whether the desired output shape, length, structure, and tone are defined" }
  },
  "strengths": ["3 short bullet-point strengths"],
  "weaknesses": ["3 short bullet-point weaknesses"],
  "recommendations": ["4 actionable, prioritized recommendations"],
  "executiveSummary": "4-6 sentence executive-grade paragraph covering overall quality, biggest wins, and most impactful improvements."
}

Rules:
- Each score is an integer 0..10. Use the full range; do not inflate.
- Feedback must be specific to the actual prompt text, not generic slogans.
- Executive summary must reference the prompt's specific content.
- Never mention the user or model outside the actual evaluation.
- Return JSON only.`;

export async function evaluatePrompt(input: {
  title: string;
  content: string;
  model: string;
  temperature?: number;
  opts: OllamaRequestOptions;
  promptId?: string;
}): Promise<EvaluationResult> {
  const { title, content, model, temperature = 0.2, opts, promptId } = input;
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/chat`;
  const body = {
    model,
    stream: false,
    format: 'json',
    options: { temperature, seed: 42 },
    messages: [
      { role: 'system', content: EVALUATION_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Evaluate this prompt.\n\nTITLE: ${title || '(untitled)'}\n\nPROMPT:\n${content}\n\nReturn JSON only.`,
      },
    ],
  };
  const res = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeOllamaError(
      'bad-response',
      `Evaluation failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : '.'}`,
      buildGuidanceForFailure(opts.baseUrl)
    );
  }
  const json: any = await res.json().catch(() => null);
  if (!json || typeof json.message?.content !== 'string') {
    throw makeOllamaError('bad-response', 'Ollama response missing message.content.', buildGuidanceForFailure(opts.baseUrl));
  }
  const parsed = parseEvaluationJson(json.message.content);
  if (!parsed) {
    throw makeOllamaError(
      'validation',
      'The model returned a response that could not be parsed into the required evaluation format. Try a higher-capability model.',
      buildGuidanceForFailure(opts.baseUrl)
    );
  }
  const dimensions = validateEvaluationDimensions(parsed.dimensions);
  if (!dimensions) {
    throw makeOllamaError(
      'validation',
      'Evaluation dimensions are malformed or missing scores/feedback.',
      buildGuidanceForFailure(opts.baseUrl)
    );
  }
  const overall = calculateWeightedScore(dimensions);
  return {
    id: uid('eval-'),
    createdAt: new Date().toISOString(),
    promptId,
    promptTitle: title,
    promptContent: content,
    model,
    dimensions,
    overallScore: overall,
    executiveSummary: typeof parsed.executiveSummary === 'string' ? parsed.executiveSummary.trim() : 'Executive summary unavailable.',
    strengths: Array.isArray(parsed.strengths) ? parsed.strengths.filter((s: any) => typeof s === 'string').slice(0, 5) : [],
    weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses.filter((w: any) => typeof w === 'string').slice(0, 5) : [],
    recommendations:
      Array.isArray(parsed.recommendations)
        ? parsed.recommendations.filter((r: any) => typeof r === 'string').slice(0, 6)
        : [],
    isDemo: false,
  };
}

function parseEvaluationJson(raw: string): any | null {
  if (!raw) return null;
  const str = raw.trim();
  const candidates: string[] = [];
  const firstBrace = str.indexOf('{');
  const lastBrace = str.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    candidates.push(str.slice(firstBrace, lastBrace + 1));
  }
  candidates.push(str);
  const codeBlock = /```(?:json)?\s*([\s\S]*?)```/i.exec(str);
  if (codeBlock) candidates.push(codeBlock[1]);
  for (const c of candidates) {
    try {
      const p = JSON.parse(c);
      if (p && typeof p === 'object') return p;
    } catch {
      // continue
    }
  }
  return null;
}

const IMPROVE_SYSTEM_PROMPT = `You are PromptIQ, a prompt engineering editor. The user will provide an original prompt. Return ONLY valid JSON:
{
  "improvedTitle": "Short improved title for the prompt",
  "improvedPromptContent": "The full improved prompt text. Do not paraphrase the original — rewrite it with: role & persona framing, explicit situational context, numbered constraints & guardrails, concrete output format with sections, and a clear success criteria / call to action. Keep structure readable with markdown headings and bullet lists.",
  "changes": ["4-6 concrete, specific changes you made (short bullets)"],
  "rationale": "2-3 sentence explanation of why these changes improve prompt quality without claiming determinism or benchmark gains."
}

Rules:
- Preserve the original intent. Do not invent entirely new requirements.
- Use plain English in rationale; keep it honest and empirical.
- Return JSON only.`;

export async function improvePrompt(input: {
  title: string;
  content: string;
  model: string;
  temperature?: number;
  opts: OllamaRequestOptions;
  promptId?: string;
}): Promise<ImprovementResult> {
  const { title, content, model, temperature = 0.4, opts, promptId } = input;
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/chat`;
  const body = {
    model,
    stream: false,
    format: 'json',
    options: { temperature, seed: 11 },
    messages: [
      { role: 'system', content: IMPROVE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Improve this prompt while preserving its intent.\n\nTITLE: ${title || '(untitled)'}\n\nPROMPT:\n${content}\n\nReturn JSON only.`,
      },
    ],
  };
  const res = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeOllamaError(
      'bad-response',
      `Improvement failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : '.'}`,
      buildGuidanceForFailure(opts.baseUrl)
    );
  }
  const json: any = await res.json().catch(() => null);
  if (!json || typeof json.message?.content !== 'string') {
    throw makeOllamaError('bad-response', 'Ollama response missing message.content.', buildGuidanceForFailure(opts.baseUrl));
  }
  const parsed = parseEvaluationJson(json.message.content);
  if (!parsed || typeof parsed.improvedPromptContent !== 'string') {
    throw makeOllamaError(
      'validation',
      'The model returned a response that could not be parsed into the required improvement format.',
      buildGuidanceForFailure(opts.baseUrl)
    );
  }
  return {
    id: uid('imp-'),
    createdAt: new Date().toISOString(),
    promptId,
    originalTitle: title,
    originalPromptContent: content,
    improvedTitle:
      typeof parsed.improvedTitle === 'string' && parsed.improvedTitle.trim().length > 0
        ? parsed.improvedTitle.trim()
        : `${title} (Improved)`,
    improvedPromptContent: parsed.improvedPromptContent,
    model,
    changes: Array.isArray(parsed.changes)
      ? parsed.changes.filter((c: any) => typeof c === 'string').slice(0, 10)
      : [],
    rationale: typeof parsed.rationale === 'string' ? parsed.rationale.trim() : 'No rationale provided.',
    isDemo: false,
  };
}

const COMPARE_SYSTEM_PROMPT = `You are PromptIQ, an expert prompt engineering auditor. Compare the two provided prompts (Prompt A and Prompt B) for LLM execution quality, clarity, robustness, and performance. Return ONLY valid JSON:
{
  "winner": "A" or "B" or "tie",
  "verdict": "2-3 sentences summarizing which prompt is more effective for an LLM and the primary reason why.",
  "keyDifferences": ["3-5 concrete bullet points describing the structural, stylistic, and instructional differences."],
  "promptAStrengths": ["2-3 specific advantages or highlights of Prompt A."],
  "promptBStrengths": ["2-3 specific advantages or highlights of Prompt B."],
  "synthesisRecommendation": "1-2 sentences on how the user could combine the best elements of both prompts into a single optimal prompt."
}

Rules:
- Be objective, technical, and analytical.
- Focus on prompt engineering principles (role framing, clarity, context, constraints, output structure).
- Return JSON only.`;

export async function comparePromptsWithAI(input: {
  promptA: { title: string; content: string };
  promptB: { title: string; content: string };
  model: string;
  temperature?: number;
  opts: OllamaRequestOptions;
}): Promise<AIComparisonAnalysis> {
  const { promptA, promptB, model, temperature = 0.3, opts } = input;
  const url = `${opts.baseUrl.replace(/\/$/, '')}/api/chat`;
  const body = {
    model,
    stream: false,
    format: 'json',
    options: { temperature, seed: 17 },
    messages: [
      { role: 'system', content: COMPARE_SYSTEM_PROMPT },
      {
        role: 'user',
        content: `Compare these two prompts:\n\n=== PROMPT A (${promptA.title || 'Prompt A'}) ===\n${promptA.content}\n\n=== PROMPT B (${promptB.title || 'Prompt B'}) ===\n${promptB.content}\n\nReturn JSON only.`,
      },
    ],
  };

  const res = await safeFetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
    timeoutMs: opts.timeoutMs,
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw makeOllamaError(
      'bad-response',
      `AI comparison failed: HTTP ${res.status}${text ? ` — ${text.slice(0, 200)}` : '.'}`,
      buildGuidanceForFailure(opts.baseUrl)
    );
  }

  const json: any = await res.json().catch(() => null);
  if (!json || typeof json.message?.content !== 'string') {
    throw makeOllamaError('bad-response', 'Ollama response missing message.content.', buildGuidanceForFailure(opts.baseUrl));
  }

  const parsed = parseEvaluationJson(json.message.content);
  if (!parsed || typeof parsed.verdict !== 'string') {
    throw makeOllamaError(
      'validation',
      'The model returned a response that could not be parsed into the required comparison format.',
      buildGuidanceForFailure(opts.baseUrl)
    );
  }

  return {
    id: uid('cmp-'),
    createdAt: new Date().toISOString(),
    promptATitle: promptA.title || 'Prompt A',
    promptBTitle: promptB.title || 'Prompt B',
    winner: parsed.winner === 'A' || parsed.winner === 'B' ? parsed.winner : 'tie',
    verdict: parsed.verdict.trim(),
    keyDifferences: Array.isArray(parsed.keyDifferences)
      ? parsed.keyDifferences.filter((x: any) => typeof x === 'string').slice(0, 6)
      : [],
    promptAStrengths: Array.isArray(parsed.promptAStrengths)
      ? parsed.promptAStrengths.filter((x: any) => typeof x === 'string').slice(0, 4)
      : [],
    promptBStrengths: Array.isArray(parsed.promptBStrengths)
      ? parsed.promptBStrengths.filter((x: any) => typeof x === 'string').slice(0, 4)
      : [],
    synthesisRecommendation: typeof parsed.synthesisRecommendation === 'string'
      ? parsed.synthesisRecommendation.trim()
      : 'Combine the concise framing of Prompt A with the structured constraints of Prompt B.',
    model,
    isDemo: false,
  };
}
