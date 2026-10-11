import React, { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LibraryBig,
  Search,
  Plus,
  Trash2,
  Copy,
  FlaskConical,
  Scale,
  Download,
  Upload,
  SlidersHorizontal,
  FolderOpen,
  ArrowUpDown,
  X,
  BookOpen,
  Tag,
  Pencil,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import { OverallScoreBadge } from '@/components/ui/ScoreMeter';
import { usePromptStore } from '@/store/usePromptStore';
import { PROMPT_CATEGORIES, type PromptCategory, type SavedPrompt } from '@/types';
import {
  cn,
  copyToClipboard,
  downloadAsFile,
  formatRelativeTime,
  scoreLabel,
  scoreToColor,
} from '@/lib/utils';

type SortKey = 'updatedAt' | 'createdAt' | 'title' | 'lastScore';
const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'updatedAt', label: 'Last Updated' },
  { key: 'createdAt', label: 'Date Created' },
  { key: 'title', label: 'Title (A→Z)' },
  { key: 'lastScore', label: 'Score (High→Low)' },
];

export default function Prompts() {
  const navigate = useNavigate();
  const prompts = usePromptStore((s) => s.prompts);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const duplicatePrompt = usePromptStore((s) => s.duplicatePrompt);
  const deletePrompt = usePromptStore((s) => s.deletePrompt);
  const importPrompts = usePromptStore((s) => s.importPrompts);
  const pushToast = usePromptStore((s) => s.pushToast);
  const setComparison = usePromptStore((s) => s.setComparison);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | PromptCategory>('All');
  const [sort, setSort] = useState<SortKey>('updatedAt');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [view, setView] = useState<'grid' | 'table'>('grid');
  const fileInput = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = prompts;
    if (category !== 'All') list = list.filter((p) => p.category === category);
    if (q) {
      list = list.filter(
        (p) =>
          p.title.toLowerCase().includes(q) ||
          p.content.toLowerCase().includes(q) ||
          p.tags.some((t) => t.toLowerCase().includes(q))
      );
    }
    const sorted = [...list].sort((a, b) => {
      switch (sort) {
        case 'title':
          return a.title.localeCompare(b.title);
        case 'createdAt':
          return +new Date(b.createdAt) - +new Date(a.createdAt);
        case 'lastScore':
          return (b.lastScore ?? -1) - (a.lastScore ?? -1);
        case 'updatedAt':
        default:
          return +new Date(b.updatedAt) - +new Date(a.updatedAt);
      }
    });
    return sorted;
  }, [prompts, query, category, sort]);

  const categoryCounts = useMemo(() => {
    const map = new Map<string, number>();
    map.set('All', prompts.length);
    for (const c of PROMPT_CATEGORIES) map.set(c, 0);
    for (const p of prompts) map.set(p.category, (map.get(p.category) ?? 0) + 1);
    return Array.from(map.entries());
  }, [prompts]);

  function createNew() {
    const p = upsertPrompt({ title: 'Untitled Prompt', content: '', category: category === 'All' ? 'General' : category });
    navigate(`/lab?prompt=${p.id}`);
  }

  function exportJSON() {
    const filename = `promptiQ-prompts-${new Date().toISOString().slice(0, 10)}.json`;
    downloadAsFile(filename, JSON.stringify(prompts, null, 2), 'application/json');
    pushToast({ type: 'success', title: 'Exported prompts', description: `${prompts.length} item${prompts.length === 1 ? '' : 's'}` });
  }

  async function importFile(file: File) {
    try {
      const text = await file.text();
      const parsed = JSON.parse(text);
      const list: SavedPrompt[] = Array.isArray(parsed) ? parsed : parsed.prompts ?? [];
      const n = importPrompts(list);
      pushToast({ type: 'success', title: 'Imported', description: `${n} prompt${n === 1 ? '' : 's'} added to library` });
    } catch (e: any) {
      pushToast({ type: 'error', title: 'Import failed', description: e?.message ?? 'Invalid JSON' });
    }
  }

  function runInEvaluator(p: SavedPrompt) {
    setComparison({ original: null });
    navigate('/evaluator', { state: { promptId: p.id } });
  }

  async function copyPromptContent(p: SavedPrompt) {
    const ok = await copyToClipboard(p.content);
    pushToast({ type: ok ? 'success' : 'error', title: ok ? 'Prompt copied' : 'Copy failed' });
  }

  function handleDelete(p: SavedPrompt) {
    if (!confirm(`Delete “${p.title}”? This cannot be undone.`)) return;
    deletePrompt(p.id);
    pushToast({ type: 'info', title: 'Deleted', description: p.title });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="My Prompts"
        title="Your saved prompt library."
        subtitle="Search, filter, sort, and manage your prompts. All data is saved locally in your browser."
        actions={
          <>
            <input
              ref={fileInput}
              type="file"
              accept="application/json"
              className="hidden"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) importFile(f);
                if (fileInput.current) fileInput.current.value = '';
              }}
            />
            <button className="btn-secondary" onClick={() => fileInput.current?.click()}>
              <Upload className="h-4 w-4" /> Import
            </button>
            <button className="btn-secondary" onClick={exportJSON} disabled={prompts.length === 0}>
              <Download className="h-4 w-4" /> Export
            </button>
            <button className="btn-primary" onClick={createNew}>
              <Plus className="h-4 w-4" /> New Prompt
            </button>
          </>
        }
      />

      <div className="card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              className="input h-10 pl-9 pr-9"
              placeholder="Search prompts by title, content, or tag…"
              aria-label="Search prompts by title, content, or tag"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button
                onClick={() => setQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md hover:bg-border-light text-muted inline-flex items-center justify-center focus:outline-none focus:ring-2 focus:ring-accent/40"
                aria-label="Clear search"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-white">
              <span className="px-3 h-10 inline-flex items-center gap-1.5 border-r border-border text-xs font-medium text-muted">
                <FolderOpen className="h-3.5 w-3.5" /> Category
              </span>
              <select
                className="h-10 px-3 bg-white text-sm outline-none"
                aria-label="Filter by category"
                value={category}
                onChange={(e) => setCategory(e.target.value as any)}
              >
                {categoryCounts.map(([c, n]) => (
                  <option key={c} value={c}>
                    {c} · {n}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden bg-white">
              <span className="px-3 h-10 inline-flex items-center gap-1.5 border-r border-border text-xs font-medium text-muted">
                <ArrowUpDown className="h-3.5 w-3.5" /> Sort
              </span>
              <select
                className="h-10 px-3 bg-white text-sm outline-none"
                aria-label="Sort prompts by"
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
              >
                {SORT_OPTIONS.map((o) => (
                  <option key={o.key} value={o.key}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="inline-flex items-center rounded-md border border-border overflow-hidden">
              <button
                onClick={() => setView('grid')}
                className={cn('h-10 px-3 inline-flex items-center gap-1.5 text-xs font-medium', view === 'grid' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink hover:bg-border-light')}
                title="Grid view"
              >
                <LibraryBig className="h-3.5 w-3.5" /> Grid
              </button>
              <button
                onClick={() => setView('table')}
                className={cn('h-10 px-3 inline-flex items-center gap-1.5 text-xs font-medium border-l border-border', view === 'table' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink hover:bg-border-light')}
                title="Table view"
              >
                <SlidersHorizontal className="h-3.5 w-3.5" /> Table
              </button>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {categoryCounts.map(([c, n]) => (
            <button
              key={c}
              onClick={() => setCategory(c as any)}
              className={cn(
                'chip hover:border-accent/30',
                category === c && '!border-accent/30 !bg-accent/10 !text-accent'
              )}
            >
              {c} <span className="text-muted/70">· {n}</span>
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 border-dashed text-center">
          <LibraryBig className="h-12 w-12 text-muted mx-auto mb-3 opacity-50" />
          <h3 className="heading-md">No prompts match</h3>
          <p className="text-sm text-muted mt-2 max-w-md mx-auto leading-relaxed">
            {prompts.length === 0
              ? 'Your library is empty. Create a new prompt or import a JSON file to get started.'
              : 'Try a different search term or category filter.'}
          </p>
          <div className="mt-5 flex items-center justify-center gap-2 flex-wrap">
            <button className="btn-secondary" onClick={() => { setQuery(''); setCategory('All'); }}>
              Reset filters
            </button>
            <button className="btn-primary" onClick={createNew}>
              <Plus className="h-4 w-4" /> Create Prompt
            </button>
          </div>
        </div>
      ) : view === 'grid' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((p) => (
            <PromptCard
              key={p.id}
              prompt={p}
              editing={editingId === p.id}
              onStartEdit={() => setEditingId(p.id)}
              onCancelEdit={() => setEditingId(null)}
              onSave={(patch) => {
                upsertPrompt({ ...p, ...patch });
                setEditingId(null);
              }}
              onOpen={() => navigate(`/lab?prompt=${p.id}`)}
              onEvaluate={() => runInEvaluator(p)}
              onCopy={() => copyPromptContent(p)}
              onDuplicate={() => {
                const c = duplicatePrompt(p.id);
                if (c) pushToast({ type: 'success', title: 'Duplicated', description: c.title });
              }}
              onDelete={() => handleDelete(p)}
            />
          ))}
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="hidden lg:grid grid-cols-12 px-5 py-3 border-b border-border bg-border-light/40 text-[11px] font-semibold uppercase tracking-wider text-muted">
            <div className="col-span-4">Title</div>
            <div className="col-span-2">Category</div>
            <div className="col-span-1">Score</div>
            <div className="col-span-2">Tags</div>
            <div className="col-span-2">Updated</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>
          <ul className="divide-y divide-border-light">
            {filtered.map((p) => (
              <li
                key={p.id}
                className="flex flex-col gap-2 px-5 py-3 text-sm lg:grid lg:grid-cols-12 lg:gap-3 lg:items-center hover:bg-border-light/60 transition-colors"
              >
                <div className="lg:col-span-4 min-w-0">
                  <button onClick={() => navigate(`/lab?prompt=${p.id}`)} className="font-medium text-ink truncate hover:text-accent text-left block w-full">
                    {p.title}
                  </button>
                  <div className="text-xs text-muted line-clamp-1 mt-0.5">{p.content || '(empty)'}</div>
                </div>
                <div className="flex items-center gap-3 lg:contents">
                  <div className="lg:col-span-2 flex items-center gap-1.5 lg:block">
                    <span className="lg:hidden text-[11px] font-medium text-muted">Category:</span>
                    <span className="chip !h-5 !text-[11px]">{p.category}</span>
                  </div>
                  <div className="lg:col-span-1 flex items-center gap-1.5 lg:block">
                    <span className="lg:hidden text-[11px] font-medium text-muted">Score:</span>
                    {typeof p.lastScore === 'number' ? (
                      <span className={cn('tabular-nums text-sm font-semibold', scoreToColor(p.lastScore))}>
                        {p.lastScore.toFixed(1)}
                      </span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </div>
                  <div className="lg:col-span-2 text-xs text-muted min-w-0">
                    <span className="lg:hidden text-[11px] font-medium text-muted mr-1.5">Tags:</span>
                    {p.tags.length === 0 ? '—' : p.tags.slice(0, 3).map((t) => `#${t}`).join(' ')}
                  </div>
                  <div className="lg:col-span-2 text-xs text-muted whitespace-nowrap">
                    <span className="lg:hidden text-[11px] font-medium text-muted mr-1.5">Updated:</span>
                    {formatRelativeTime(p.updatedAt)}
                  </div>
                  <div className="lg:col-span-1 flex justify-end gap-0.5 ml-auto lg:ml-0">
                    <button onClick={() => navigate(`/lab?prompt=${p.id}`)} className="btn-ghost !p-1.5 h-7 w-7" title="Edit in Lab" aria-label="Edit in Lab">
                      <FlaskConical className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => runInEvaluator(p)} className="btn-ghost !p-1.5 h-7 w-7" title="Run Evaluator" aria-label="Run Evaluator">
                      <Scale className="h-3.5 w-3.5" />
                    </button>
                    <button onClick={() => handleDelete(p)} className="btn-ghost !p-1.5 h-7 w-7 text-score-poor hover:bg-score-poor/10" title="Delete" aria-label="Delete prompt">
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function PromptCard({
  prompt,
  editing,
  onStartEdit,
  onCancelEdit,
  onSave,
  onOpen,
  onEvaluate,
  onCopy,
  onDuplicate,
  onDelete,
}: {
  prompt: SavedPrompt;
  editing: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onSave: (patch: Partial<SavedPrompt>) => void;
  onOpen: () => void;
  onEvaluate: () => void;
  onCopy: () => void;
  onDuplicate: () => void;
  onDelete: () => void;
}) {
  const [title, setTitle] = useState(prompt.title);
  const [category, setCategory] = useState<PromptCategory>(prompt.category);
  const [tagsStr, setTagsStr] = useState(prompt.tags.join(', '));

  React.useEffect(() => {
    setTitle(prompt.title);
    setCategory(prompt.category);
    setTagsStr(prompt.tags.join(', '));
  }, [prompt.id]);

  return (
    <article className="card-hover p-5 flex flex-col min-h-[220px] md:min-h-[260px]">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex-1 min-w-0">
          {editing ? (
            <input
              className="input h-9 font-semibold"
              autoFocus
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          ) : (
            <button onClick={onOpen} className="text-left block w-full">
              <h3 className="heading-md truncate">{prompt.title}</h3>
            </button>
          )}
          <div className="mt-1 flex items-center gap-2 flex-wrap">
            {editing ? (
              <select
                className="input h-7 text-xs py-1 px-2 inline-flex"
                value={category}
                onChange={(e) => setCategory(e.target.value as PromptCategory)}
              >
                {PROMPT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            ) : (
              <span className="chip !h-5 !text-[11px]">{prompt.category}</span>
            )}
            {typeof prompt.lastScore === 'number' && (
              <span className="inline-flex items-center gap-1 text-xs">
                <span className={cn('font-semibold tabular-nums', scoreToColor(prompt.lastScore))}>
                  {prompt.lastScore.toFixed(1)}
                </span>
                <span className="text-muted">{scoreLabel(prompt.lastScore)}</span>
              </span>
            )}
            <span className="text-[11px] text-muted">
              {formatRelativeTime(prompt.updatedAt)}
            </span>
          </div>
        </div>
        {typeof prompt.lastScore === 'number' ? (
          <OverallScoreBadge score={prompt.lastScore} size="sm" />
        ) : (
          <div className="h-12 w-12 shrink-0 rounded-full ring-1 ring-border bg-border-light/50 flex items-center justify-center text-muted">
            <BookOpen className="h-5 w-5" />
          </div>
        )}
      </div>

      <div className="mt-1 text-xs text-muted flex items-center gap-1.5 flex-wrap">
        <Tag className="h-3 w-3" />
        {editing ? (
          <input
            className="input h-7 text-xs py-1 px-2 flex-1 min-w-[140px]"
            placeholder="tag1, tag2, tag3"
            value={tagsStr}
            onChange={(e) => setTagsStr(e.target.value)}
          />
        ) : prompt.tags.length > 0 ? (
          prompt.tags.slice(0, 4).map((t) => (
            <span key={t} className="text-[11px] text-muted">
              #{t}
            </span>
          ))
        ) : (
          <span className="italic text-muted/70">No tags</span>
        )}
      </div>

      <div className="mt-3 flex-1 min-h-[72px]">
        <div className="text-sm text-ink/85 leading-relaxed line-clamp-4 whitespace-pre-wrap">
          {prompt.content || <span className="text-muted/60 italic">Empty prompt — click to edit.</span>}
        </div>
      </div>

      <div className="mt-4 pt-4 border-t border-border flex items-center justify-between gap-1">
        {editing ? (
          <div className="flex items-center gap-1.5">
            <button
              className="btn-primary !py-1.5 !px-3 text-xs"
              onClick={() =>
                onSave({
                  title: title.trim() || prompt.title,
                  category,
                  tags: tagsStr
                    .split(',')
                    .map((t) => t.trim().replace(/^#/, ''))
                    .filter(Boolean),
                })
              }
            >
              Save
            </button>
            <button className="btn-secondary !py-1.5 !px-3 text-xs" onClick={onCancelEdit}>
              Cancel
            </button>
          </div>
        ) : (
          <>
            <div className="flex items-center gap-1 min-w-0">
              <button className="btn-ghost !py-1.5 !px-2 text-xs" onClick={onOpen} title="Open in Prompt Lab">
                <FlaskConical className="h-3.5 w-3.5" /> Edit
              </button>
              <button className="btn-ghost !py-1.5 !px-2 text-xs" onClick={onEvaluate} title="Evaluate prompt">
                <Scale className="h-3.5 w-3.5" /> Evaluate
              </button>
              <button className="btn-ghost !py-1.5 !px-2 text-xs" onClick={onCopy} title="Copy prompt content">
                <Copy className="h-3.5 w-3.5" /> Copy
              </button>
            </div>
            <div className="flex items-center gap-0.5 shrink-0">
              <button className="btn-ghost !p-1.5 h-7 w-7" onClick={onDuplicate} title="Duplicate" aria-label="Duplicate prompt">
                <Copy className="h-3.5 w-3.5" />
              </button>
              <button className="btn-ghost !p-1.5 h-7 w-7" onClick={onStartEdit} title="Edit details" aria-label="Edit prompt details">
                <Pencil className="h-3.5 w-3.5" />
              </button>
              <button className="btn-ghost !p-1.5 h-7 w-7 text-score-poor hover:bg-score-poor/10" onClick={onDelete} title="Delete" aria-label="Delete prompt">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          </>
        )}
      </div>
    </article>
  );
}
