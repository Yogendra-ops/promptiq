import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';
import {
  DIMENSION_WEIGHTS,
  type EvaluationDimension,
  type DimensionScore,
  type EvaluationResult,
  type PromptCounters,
} from '@/types';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function uid(prefix = ''): string {
  const rand = Math.random().toString(36).slice(2, 10);
  const t = Date.now().toString(36);
  return `${prefix}${t}${rand}`;
}

export function formatDate(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return d.toLocaleString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function formatRelativeTime(iso: string): string {
  try {
    const diff = Date.now() - new Date(iso).getTime();
    const m = Math.floor(diff / 60000);
    if (m < 1) return 'just now';
    if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24);
    if (d < 7) return `${d}d ago`;
    return formatDate(iso);
  } catch {
    return iso;
  }
}

export function countTokensEstimate(text: string): number {
  if (!text) return 0;
  const cleaned = text.trim();
  if (!cleaned) return 0;
  const chars = cleaned.length;
  const words = cleaned.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.round(words * 0.75 + chars / 4));
}

export function computeCounters(content: string): PromptCounters {
  const text = content ?? '';
  const trimmed = text.trim();
  const words = trimmed ? trimmed.split(/\s+/).filter(Boolean).length : 0;
  const characters = text.length;
  const charactersNoSpaces = text.replace(/\s/g, '').length;
  const sentences = trimmed ? (trimmed.match(/[.!?]+[\s\]")'`]*/g)?.length ?? 1) : 0;
  const paragraphs = trimmed ? trimmed.split(/\n\s*\n/).filter((p) => p.trim()).length : 0;
  const estimatedTokens = countTokensEstimate(text);
  return { words, characters, charactersNoSpaces, sentences, paragraphs, estimatedTokens };
}

export function calculateWeightedScore(
  dimensions: Record<EvaluationDimension, DimensionScore>
): number {
  const entries = Object.entries(DIMENSION_WEIGHTS) as [EvaluationDimension, number][];
  let total = 0;
  let weightSum = 0;
  for (const [dim, weight] of entries) {
    const score = dimensions[dim]?.score ?? 0;
    total += score * weight;
    weightSum += weight;
  }
  return weightSum === 0 ? 0 : Math.round((total / weightSum) * 10) / 10;
}

export function scoreTier(score: number): 'excellent' | 'good' | 'fair' | 'poor' {
  if (score >= 8) return 'excellent';
  if (score >= 6.5) return 'good';
  if (score >= 4.5) return 'fair';
  return 'poor';
}

export function scoreLabel(score: number): string {
  const tier = scoreTier(score);
  switch (tier) {
    case 'excellent':
      return 'Excellent';
    case 'good':
      return 'Good';
    case 'fair':
      return 'Fair';
    case 'poor':
      return 'Needs Work';
  }
}

export function scoreToColor(score: number): string {
  const tier = scoreTier(score);
  switch (tier) {
    case 'excellent':
      return 'text-score-excellent';
    case 'good':
      return 'text-score-good';
    case 'fair':
      return 'text-score-fair';
    case 'poor':
      return 'text-score-poor';
  }
}

export function scoreToBgColor(score: number): string {
  const tier = scoreTier(score);
  switch (tier) {
    case 'excellent':
      return 'bg-score-excellent';
    case 'good':
      return 'bg-score-good';
    case 'fair':
      return 'bg-score-fair';
    case 'poor':
      return 'bg-score-poor';
  }
}

export function downloadAsFile(filename: string, content: string, mime = 'text/plain') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand('copy');
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  }
}

export function exportEvaluationToMarkdown(result: EvaluationResult): string {
  const lines: string[] = [];
  lines.push(`# Prompt Evaluation Report`);
  lines.push('');
  lines.push(`**Title:** ${result.promptTitle}`);
  lines.push(`**Model:** ${result.model}`);
  lines.push(`**Date:** ${formatDateTime(result.createdAt)}`);
  lines.push(`**Overall Score:** ${result.overallScore.toFixed(1)} / 10 — ${scoreLabel(result.overallScore)}`);
  lines.push('');
  lines.push('## Executive Summary');
  lines.push('');
  lines.push(result.executiveSummary);
  lines.push('');
  lines.push('## Dimension Scores');
  lines.push('');
  for (const dim of Object.keys(DIMENSION_WEIGHTS) as EvaluationDimension[]) {
    const d = result.dimensions[dim];
    const w = Math.round(DIMENSION_WEIGHTS[dim] * 100);
    lines.push(`### ${DIMENSION_WEIGHTS ? '' : ''}${dim} (${w}% weight): ${d.score}/10`);
    lines.push('');
    lines.push(d.feedback);
    lines.push('');
  }
  lines.push('## Strengths');
  lines.push('');
  for (const s of result.strengths) lines.push(`- ${s}`);
  lines.push('');
  lines.push('## Areas to Improve');
  lines.push('');
  for (const w of result.weaknesses) lines.push(`- ${w}`);
  lines.push('');
  lines.push('## Recommendations');
  lines.push('');
  for (const r of result.recommendations) lines.push(`1. ${r}`);
  lines.push('');
  lines.push('---');
  lines.push('*Generated by PromptIQ Enterprise*');
  return lines.join('\n');
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80);
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function throttle<T extends (...args: any[]) => any>(fn: T, wait = 300): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null;
  return function (this: any, ...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => fn.apply(this, args), wait);
  };
}

const DIMENSIONS: EvaluationDimension[] = ['clarity', 'context', 'specificity', 'constraints', 'outputExpectations'];

export function validateEvaluationDimensions(raw: any): Record<EvaluationDimension, DimensionScore> | null {
  if (!raw || typeof raw !== 'object') return null;
  const out: any = {};
  for (const d of DIMENSIONS) {
    const entry = raw[d];
    if (!entry || typeof entry !== 'object') return null;
    const score = Number(entry.score);
    if (!Number.isFinite(score) || score < 0 || score > 10) return null;
    const feedback = typeof entry.feedback === 'string' ? entry.feedback : '';
    if (!feedback) return null;
    out[d] = { score, feedback, examples: Array.isArray(entry.examples) ? entry.examples : undefined };
  }
  return out;
}
