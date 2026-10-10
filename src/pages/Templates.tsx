import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutTemplate,
  Mail,
  FileText,
  Calendar,
  BarChart3,
  Database,
  BookOpen,
  Search,
  ChevronRight,
  Sparkles,
  Copy,
  Save,
  FlaskConical,
  X,
  Wand2,
  Eye,
  ArrowRight,
} from 'lucide-react';
import { PageHeader } from '@/components/layout/TopNav';
import { usePromptStore } from '@/store/usePromptStore';
import { DEMO_TEMPLATES } from '@/lib/demoData';
import { PROMPT_CATEGORIES, type PromptCategory, type SavedPrompt, type PromptTemplate, type TemplateVariable } from '@/types';
import { cn, copyToClipboard, slugify } from '@/lib/utils';

const TEMPLATE_ICON_MAP: Record<string, any> = {
  Mail,
  FileText,
  Calendar,
  BarChart3,
  Database,
  BookOpen,
};

export default function Templates() {
  const navigate = useNavigate();
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const pushToast = usePromptStore((s) => s.pushToast);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'All' | PromptCategory>('All');
  const [selectedId, setSelectedId] = useState<string | null>(DEMO_TEMPLATES[0]?.id ?? null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    let list = DEMO_TEMPLATES;
    if (category !== 'All') list = list.filter((t) => t.category === category);
    if (q) {
      list = list.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.description.toLowerCase().includes(q) ||
          t.content.toLowerCase().includes(q)
      );
    }
    return list;
  }, [query, category]);

  const selected = DEMO_TEMPLATES.find((t) => t.id === selectedId) ?? filtered[0] ?? null;

  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && DEMO_TEMPLATES.some((t) => t.id === hash)) {
      setSelectedId(hash);
    }
  }, []);

  function saveAsPrompt(tpl: PromptTemplate, values: Record<string, string>) {
    const content = fillTemplate(tpl, values);
    const saved = upsertPrompt({
      title: `${tpl.name} Prompt`,
      content,
      category: tpl.category,
      tags: ['template', tpl.name.toLowerCase().replace(/\s+/g, '-')],
    });
    pushToast({ type: 'success', title: 'Saved from template', description: saved.title });
    navigate(`/lab?prompt=${saved.id}`);
  }

  async function copyFilled(tpl: PromptTemplate, values: Record<string, string>) {
    const ok = await copyToClipboard(fillTemplate(tpl, values));
    pushToast({ type: ok ? 'success' : 'error', title: ok ? 'Prompt copied' : 'Copy failed' });
  }

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Templates"
        title="Reusable prompt templates."
        subtitle="Fill in variables to generate structured prompts for common use cases. Edit the output in Prompt Lab before saving."
        actions={
          <button className="btn-primary" onClick={() => navigate('/lab')}>
            <FlaskConical className="h-4 w-4" /> Open Prompt Lab
          </button>
        }
      />

      <div className="card p-4 space-y-4">
        <div className="flex flex-col md:flex-row md:items-center gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted" />
            <input
              className="input h-10 pl-9"
              placeholder="Search templates…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="flex flex-wrap gap-1.5">
            {['All', ...PROMPT_CATEGORIES].map((c) => (
              <button
                key={c}
                onClick={() => setCategory(c as any)}
                className={cn(
                  'chip hover:border-accent/30',
                  category === c && '!border-accent/30 !bg-accent/10 !text-accent'
                )}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card p-10 border-dashed text-center">
          <LayoutTemplate className="h-12 w-12 text-muted mx-auto mb-3 opacity-50" />
          <h3 className="heading-md">No templates match</h3>
          <p className="text-sm text-muted mt-2">Try a different search term or category.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-5 space-y-2">
            <div className="section-title px-1 mb-1">Choose a template</div>
            <ul className="space-y-2">
              {filtered.map((t) => {
                const Icon = TEMPLATE_ICON_MAP[t.icon] ?? LayoutTemplate;
                const active = t.id === selected?.id;
                return (
                  <li key={t.id}>
                    <button
                      onClick={() => setSelectedId(t.id)}
                      className={cn(
                        'w-full text-left p-4 rounded-lg border transition-all bg-white group',
                        active
                          ? 'border-accent/40 shadow-card-hover ring-1 ring-accent/20'
                          : 'border-border hover:border-accent/20 hover:shadow-card'
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <div
                          className={cn(
                            'h-10 w-10 rounded-md flex items-center justify-center shrink-0',
                            active
                              ? 'bg-accent/10 text-accent ring-1 ring-accent/20'
                              : 'bg-border-light text-muted group-hover:text-accent group-hover:bg-accent/5'
                          )}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2">
                            <h3 className="heading-md">{t.name}</h3>
                            <ChevronRight
                              className={cn(
                                'h-4 w-4 shrink-0 transition-transform',
                                active ? 'text-accent translate-x-0.5' : 'text-muted'
                              )}
                            />
                          </div>
                          <p className="mt-0.5 text-xs text-muted leading-relaxed line-clamp-2">
                            {t.description}
                          </p>
                          <div className="mt-2 flex items-center gap-2 flex-wrap">
                            <span className="chip !h-5 !text-[11px]">{t.category}</span>
                            <span className="text-[11px] text-muted inline-flex items-center gap-1">
                              <Wand2 className="h-3 w-3" /> {t.variables.length} variable
                              {t.variables.length === 1 ? '' : 's'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="lg:col-span-7">
            {selected ? (
              <TemplateDetail
                key={selected.id}
                template={selected}
                onSave={(vals) => saveAsPrompt(selected, vals)}
                onCopy={(vals) => copyFilled(selected, vals)}
                onOpenLab={(vals) => {
                  const saved = upsertPrompt({
                    title: `${selected.name} Prompt`,
                    content: fillTemplate(selected, vals),
                    category: selected.category,
                    tags: ['template'],
                  });
                  navigate(`/lab?prompt=${saved.id}`);
                }}
              />
            ) : (
              <div className="card p-10 border-dashed text-center h-full flex items-center justify-center">
                <div>
                  <LayoutTemplate className="h-12 w-12 text-muted mx-auto mb-3 opacity-50" />
                  <h3 className="heading-md">Select a template</h3>
                  <p className="text-sm text-muted mt-2 max-w-md mx-auto">
                    Pick a template from the list to fill in variables and preview the output.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function fillTemplate(tpl: PromptTemplate, values: Record<string, string>): string {
  let out = tpl.content;
  for (const v of tpl.variables) {
    const val = (values[v.name] ?? v.defaultValue ?? '').trim();
    out = out.replace(new RegExp(`\\{\\{${v.name}\\}\\}`, 'g'), val || `[${v.label}]`);
  }
  return out;
}

function TemplateDetail({
  template,
  onSave,
  onCopy,
  onOpenLab,
}: {
  template: PromptTemplate;
  onSave: (values: Record<string, string>) => void;
  onCopy: (values: Record<string, string>) => void;
  onOpenLab: (values: Record<string, string>) => void;
}) {
  const [mode, setMode] = useState<'fill' | 'preview'>('fill');
  const [values, setValues] = useState<Record<string, string>>(() => {
    const v: Record<string, string> = {};
    for (const vr of template.variables) v[vr.name] = vr.defaultValue ?? '';
    return v;
  });

  const filled = fillTemplate(template, values);
  const Icon = TEMPLATE_ICON_MAP[template.icon] ?? LayoutTemplate;

  return (
    <div className="card overflow-hidden">
      <div className="px-6 py-5 border-b border-border bg-gradient-to-b from-accent/[0.04] to-transparent">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="h-12 w-12 rounded-lg bg-accent/10 text-accent ring-1 ring-accent/20 flex items-center justify-center shrink-0">
              <Icon className="h-6 w-6" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="heading-lg leading-tight">{template.name}</h2>
                <span className="chip-accent !h-5 !text-[11px]">Template</span>
              </div>
              <p className="mt-1 text-sm text-muted max-w-xl leading-relaxed">{template.description}</p>
              <div className="mt-2 flex items-center gap-2 flex-wrap text-[11px] text-muted">
                <span className="chip !h-5 !text-[11px]">{template.category}</span>
                <span>· {template.variables.length} variable{template.variables.length === 1 ? '' : 's'}</span>
              </div>
            </div>
          </div>
          <div className="inline-flex rounded-md border border-border overflow-hidden bg-white shrink-0">
            <button
              onClick={() => setMode('fill')}
              className={cn('px-3 h-9 text-xs font-medium inline-flex items-center gap-1.5', mode === 'fill' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink hover:bg-border-light')}
            >
              <Wand2 className="h-3.5 w-3.5" /> Variables
            </button>
            <button
              onClick={() => setMode('preview')}
              className={cn('px-3 h-9 text-xs font-medium inline-flex items-center gap-1.5 border-l border-border', mode === 'preview' ? 'bg-accent/10 text-accent' : 'text-muted hover:text-ink hover:bg-border-light')}
            >
              <Eye className="h-3.5 w-3.5" /> Preview
            </button>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2">
        <div className="p-6 border-b md:border-b-0 md:border-r border-border space-y-4">
          <div className="section-title mb-1">Variables</div>
          {template.variables.length === 0 ? (
            <p className="text-sm text-muted">No variables — this template is ready to use as-is.</p>
          ) : (
            <ul className="space-y-3">
              {template.variables.map((v: TemplateVariable) => (
                <VariableField
                  key={v.name}
                  v={v}
                  value={values[v.name] ?? ''}
                  onChange={(val) => setValues({ ...values, [v.name]: val })}
                />
              ))}
            </ul>
          )}
        </div>
        <div className="p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div className="section-title mb-0">
              {mode === 'fill' ? 'Generated Prompt' : 'Preview'}
            </div>
            <button
              className="btn-ghost !p-1.5 h-7 text-xs"
              onClick={() => onCopy(values)}
              title="Copy"
            >
              <Copy className="h-3.5 w-3.5" /> Copy
            </button>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-[13px] leading-relaxed text-ink/90 border border-border rounded-lg p-4 bg-white/70 h-[340px] overflow-y-auto scrollbar-thin">
            {filled || '(empty)'}
          </pre>
        </div>
      </div>

      <div className="px-6 py-4 border-t border-border bg-border-light/40 flex flex-wrap items-center gap-2 justify-between">
        <div className="text-xs text-muted">
          {template.variables.length === 0
            ? 'No variables to fill. Save or open this template in Prompt Lab.'
            : `Tip: wrap optional sections in ${'{{brackets}}'} to keep placeholders for later.`}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button className="btn-secondary" onClick={() => onCopy(values)}>
            <Copy className="h-4 w-4" /> Copy
          </button>
          <button className="btn-secondary" onClick={() => onSave(values)}>
            <Save className="h-4 w-4" /> Save to Library
          </button>
          <button className="btn-primary" onClick={() => onOpenLab(values)}>
            <FlaskConical className="h-4 w-4" />
            Open in Lab
            <ArrowRight className="h-4 w-4 -mr-1" />
          </button>
        </div>
      </div>
    </div>
  );
}

function VariableField({
  v,
  value,
  onChange,
}: {
  v: TemplateVariable;
  value: string;
  onChange: (value: string) => void;
}) {
  const long =
    v.description?.toLowerCase().includes('long') ||
    v.label.toLowerCase().includes('document') ||
    v.label.toLowerCase().includes('notes') ||
    v.label.toLowerCase().includes('schema') ||
    v.label.toLowerCase().includes('transcript') ||
    v.name === 'document' ||
    v.name === 'notes' ||
    v.name === 'data' ||
    v.name === 'code' ||
    v.name === 'keyPoints' ||
    v.name === 'schema' ||
    v.name === 'context';
  return (
    <li className="space-y-1.5">
      <label className="flex items-center justify-between gap-2">
        <span className="label !mb-0 flex items-center gap-1.5">
          <code className="text-[11px] bg-border-light border border-border rounded px-1.5 py-0.5 font-mono text-accent">
            {`{{${v.name}}}`}
          </code>
          {v.label}
        </span>
        {value && (
          <button
            onClick={() => onChange('')}
            className="text-[11px] text-muted hover:text-score-poor inline-flex items-center gap-0.5"
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}
      </label>
      {v.description && (
        <p className="text-[11px] text-muted leading-snug">{v.description}</p>
      )}
      {long ? (
        <textarea
          className="textarea min-h-[96px] text-[13px]"
          placeholder={v.defaultValue || `e.g. ${v.label.toLowerCase()}…`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          spellCheck={false}
        />
      ) : (
        <input
          className="input h-10 text-[13px]"
          placeholder={v.defaultValue || `e.g. ${v.label.toLowerCase()}…`}
          value={value}
          onChange={(e) => onChange(e.target.value)}
        />
      )}
    </li>
  );
}
