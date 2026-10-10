import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Save, FlaskConical, Scale, Sparkles } from 'lucide-react';
import ModelSelector from '@/components/ui/ModelSelector';
import PromptCounters from '@/components/ui/PromptCounters';
import { PROMPT_CATEGORIES, type PromptCategory, type SavedPrompt } from '@/types';
import { usePromptStore } from '@/store/usePromptStore';
import { storage } from '@/lib/storage';

interface Props {
  initialTitle?: string;
  initialContent?: string;
  initialCategory?: PromptCategory;
  onSave?: (p: SavedPrompt) => void;
  onEvaluate?: ((draft: { title: string; content: string }) => void) | null;
  onImprove?: ((draft: { title: string; content: string }) => void) | null;
  onChangeDraft?: (draft: { title: string; content: string }) => void;
  saveLabel?: string;
  saveDisabled?: boolean;
  evalLabel?: string;
  evalDisabled?: boolean;
  improveLabel?: string;
  improveDisabled?: boolean;
  showModel?: boolean;
  autosaveKey?: string;
  existingPromptId?: string;
  hideCategory?: boolean;
  actionsLeft?: React.ReactNode;
}

export default function PromptEditor(props: Props) {
  const [sp] = useSearchParams();
  const urlPromptId = props.existingPromptId ?? sp.get('prompt') ?? undefined;
  const prompts = usePromptStore((s) => s.prompts);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const pushToast = usePromptStore((s) => s.pushToast);

  const loaded = urlPromptId ? prompts.find((p) => p.id === urlPromptId) : undefined;

  const initialT = loaded?.title ?? props.initialTitle ?? (props.autosaveKey ? storage.getLabState()?.title ?? '' : '');
  const initialC = loaded?.content ?? props.initialContent ?? (props.autosaveKey ? storage.getLabState()?.content ?? '' : '');
  const initialCat = (loaded?.category as PromptCategory) ?? props.initialCategory ?? 'General';

  const [title, setTitle] = useState(initialT);
  const [content, setContent] = useState(initialC);
  const [category, setCategory] = useState<PromptCategory>(initialCat);

  useEffect(() => {
    if (loaded) {
      setTitle(loaded.title);
      setContent(loaded.content);
      setCategory((loaded.category as PromptCategory) || initialCat);
    }
  }, [loaded?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    props.onChangeDraft?.({ title, content });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content]);

  useEffect(() => {
    if (!props.autosaveKey) return;
    const id = setTimeout(() => {
      storage.saveLabState({ title, content });
    }, 400);
    return () => clearTimeout(id);
  }, [title, content, props.autosaveKey]);

  function save() {
    if (!title.trim() && !content.trim()) {
      pushToast({ type: 'error', title: 'Nothing to save', description: 'Add a title or some prompt content first.' });
      return;
    }
    const saved = upsertPrompt({
      id: loaded?.id,
      title: title.trim() || 'Untitled Prompt',
      content,
      category,
    });
    pushToast({ type: 'success', title: 'Prompt saved', description: saved.title });
    props.onSave?.(saved);
    return saved;
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="md:col-span-2 space-y-1">
          <label className="label">Prompt Title</label>
          <input
            type="text"
            className="input h-11 font-medium"
            placeholder="e.g. Customer escalation response"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
        </div>
        {!props.hideCategory && (
          <div className="space-y-1">
            <label className="label">Category</label>
            <select
              className="input h-11"
              value={category}
              onChange={(e) => setCategory(e.target.value as PromptCategory)}
            >
              {PROMPT_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="flex items-center justify-between">
          <label className="label">Prompt Content</label>
          <span className="text-[11px] text-muted">Use Markdown formatting for rich structure.</span>
        </div>
        <textarea
          className="textarea min-h-[220px] font-mono text-[13px]"
          placeholder={`Write your prompt here. Use headings, constraints, and a clear output format for best results.

# Role & Task
You are an expert…

# Context
Provide the situation here…

# Constraints
- Maximum 500 words
- No marketing language

# Output Format
1. Executive summary
2. Detailed findings
3. Recommendations`}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          spellCheck={false}
        />
      </div>

      <PromptCounters content={content} />

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 pt-2">
        {props.showModel !== false && (
          <div className="lg:col-span-1">
            <ModelSelector />
          </div>
        )}
        <div className={props.showModel === false ? 'lg:col-span-3' : 'lg:col-span-2'}>
          <div className="flex flex-wrap gap-2 justify-start lg:justify-end">
            {props.actionsLeft}
            <button
              className="btn-secondary"
              onClick={save}
              disabled={props.saveDisabled}
            >
              <Save className="h-4 w-4" />
              {props.saveLabel ?? 'Save to Library'}
            </button>
            {props.onImprove !== null && (
              <button
                className="btn-secondary"
                onClick={() => props.onImprove?.({ title, content })}
                disabled={props.improveDisabled ?? !content.trim()}
              >
                <Sparkles className="h-4 w-4" />
                {props.improveLabel ?? 'Improve Prompt'}
              </button>
            )}
            {props.onEvaluate !== null && (
              <button
                className="btn-primary"
                onClick={() => props.onEvaluate?.({ title, content })}
                disabled={props.evalDisabled ?? !content.trim()}
              >
                <Scale className="h-4 w-4" />
                {props.evalLabel ?? 'Evaluate Prompt'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
