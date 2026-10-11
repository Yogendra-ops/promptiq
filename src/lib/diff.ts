export interface DiffChunk {
  type: 'equal' | 'add' | 'remove';
  value: string;
}

export interface UnifiedDiffLine {
  type: 'equal' | 'add' | 'remove';
  content: string;
}

/**
 * Tokenizes text into words, whitespace, and punctuation tokens while preserving exact reconstruction.
 */
function tokenizeWords(text: string): string[] {
  if (!text) return [];
  const tokens = text.match(/([^\S\r\n]+|\r?\n|\w+|[^\w\s])/g);
  return tokens || [text];
}

/**
 * Computes word-level diff between original and modified text using Longest Common Subsequence (LCS).
 * Fast and memory-safe with token limits.
 */
export function computeWordDiff(original: string, modified: string): DiffChunk[] {
  if (original === modified) {
    return original ? [{ type: 'equal', value: original }] : [];
  }
  if (!original) {
    return modified ? [{ type: 'add', value: modified }] : [];
  }
  if (!modified) {
    return original ? [{ type: 'remove', value: original }] : [];
  }

  const a = tokenizeWords(original);
  const b = tokenizeWords(modified);

  // If token count is large, fall back to line diff to avoid quadratic memory
  if (a.length * b.length > 2_000_000) {
    return computeLineDiffAsChunks(original, modified);
  }

  const m = a.length;
  const n = b.length;

  // LCS length matrix using typed array for speed and compact memory
  const dp: Int32Array = new Int32Array((m + 1) * (n + 1));
  const getIdx = (i: number, j: number) => i * (n + 1) + j;

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (a[i] === b[j]) {
        dp[getIdx(i + 1, j + 1)] = dp[getIdx(i, j)] + 1;
      } else {
        const up = dp[getIdx(i, j + 1)];
        const left = dp[getIdx(i + 1, j)];
        dp[getIdx(i + 1, j + 1)] = up >= left ? up : left;
      }
    }
  }

  // Backtrack to build diff
  const rawChunks: DiffChunk[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i - 1] === b[j - 1]) {
      rawChunks.push({ type: 'equal', value: a[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[getIdx(i, j - 1)] >= dp[getIdx(i - 1, j)])) {
      rawChunks.push({ type: 'add', value: b[j - 1] });
      j--;
    } else if (i > 0) {
      rawChunks.push({ type: 'remove', value: a[i - 1] });
      i--;
    }
  }

  rawChunks.reverse();

  // Merge contiguous chunks of the same type
  const merged: DiffChunk[] = [];
  for (const chunk of rawChunks) {
    const last = merged[merged.length - 1];
    if (last && last.type === chunk.type) {
      last.value += chunk.value;
    } else {
      merged.push({ ...chunk });
    }
  }

  return merged;
}

/**
 * Fallback line-level diff converted into chunks
 */
function computeLineDiffAsChunks(original: string, modified: string): DiffChunk[] {
  const linesA = original.split('\n');
  const linesB = modified.split('\n');
  const chunks: DiffChunk[] = [];

  const max = Math.max(linesA.length, linesB.length);
  for (let i = 0; i < max; i++) {
    const la = linesA[i];
    const lb = linesB[i];
    if (la === lb) {
      chunks.push({ type: 'equal', value: (la ?? '') + (i < max - 1 ? '\n' : '') });
    } else {
      if (la !== undefined) chunks.push({ type: 'remove', value: la + (i < linesA.length - 1 ? '\n' : '') });
      if (lb !== undefined) chunks.push({ type: 'add', value: lb + (i < linesB.length - 1 ? '\n' : '') });
    }
  }
  return chunks;
}

/**
 * Computes unified diff lines for line-by-line display.
 */
export function computeUnifiedDiffLines(original: string, modified: string): UnifiedDiffLine[] {
  const linesA = original.split(/\r?\n/);
  const linesB = modified.split(/\r?\n/);

  // Line-level LCS
  const m = linesA.length;
  const n = linesB.length;

  const dp: Int32Array = new Int32Array((m + 1) * (n + 1));
  const getIdx = (i: number, j: number) => i * (n + 1) + j;

  for (let i = 0; i < m; i++) {
    for (let j = 0; j < n; j++) {
      if (linesA[i] === linesB[j]) {
        dp[getIdx(i + 1, j + 1)] = dp[getIdx(i, j)] + 1;
      } else {
        const up = dp[getIdx(i, j + 1)];
        const left = dp[getIdx(i + 1, j)];
        dp[getIdx(i + 1, j + 1)] = up >= left ? up : left;
      }
    }
  }

  const raw: UnifiedDiffLine[] = [];
  let i = m;
  let j = n;

  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
      raw.push({ type: 'equal', content: linesA[i - 1] });
      i--;
      j--;
    } else if (j > 0 && (i === 0 || dp[getIdx(i, j - 1)] >= dp[getIdx(i - 1, j)])) {
      raw.push({ type: 'add', content: linesB[j - 1] });
      j--;
    } else if (i > 0) {
      raw.push({ type: 'remove', content: linesA[i - 1] });
      i--;
    }
  }

  raw.reverse();
  return raw;
}
