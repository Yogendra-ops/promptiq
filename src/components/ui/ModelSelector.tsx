import { useEffect, useState } from 'react';
import { Loader2, ChevronDown, RefreshCw, AlertTriangle, Sparkles } from 'lucide-react';
import { usePromptStore } from '@/store/usePromptStore';
import { cn, formatBytes } from '@/lib/utils';
import type { OllamaModel } from '@/types';

export default function ModelSelector({ className }: { className?: string }) {
  const models = usePromptStore((s) => s.models);
  const settings = usePromptStore((s) => s.settings.ollama);
  const discover = usePromptStore((s) => s.discoverModels);
  const select = usePromptStore((s) => s.setSelectedModel);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  async function refresh() {
    setLoading(true);
    setErrorMsg(null);
    const { error } = await discover();
    if (error) setErrorMsg(error.message);
    setLoading(false);
  }

  useEffect(() => {
    if (!demoMode && models.length === 0 && settings.connectionStatus === 'unknown') {
      refresh();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const hasSelection = !!settings.selectedModel || demoMode;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="flex items-center justify-between">
        <label className="label">{demoMode ? 'Model (Demo Mode)' : 'Ollama Model'}</label>
        {!demoMode && (
          <button
            type="button"
            onClick={refresh}
            className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-accent transition-colors disabled:opacity-50"
            disabled={loading}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            {loading ? 'Scanning…' : 'Refresh models'}
          </button>
        )}
      </div>

      {demoMode ? (
        <div className="flex items-center gap-3 px-3 h-11 border border-accent/20 rounded-md bg-accent/5 text-sm">
          <div className="h-8 w-8 rounded-md bg-accent/15 text-accent flex items-center justify-center shrink-0">
            <Sparkles className="h-4 w-4" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-accent">demo-mock-7b</div>
            <div className="text-xs text-muted truncate">Static samples. Connect Ollama for live AI.</div>
          </div>
        </div>
      ) : (
        <div className="relative">
          <select
            value={settings.selectedModel}
            onChange={(e) => select(e.target.value)}
            className="input h-11 appearance-none pr-10 pl-3 font-medium"
            disabled={loading}
          >
            <option value="">
              {models.length === 0
                ? loading
                  ? 'Discovering models…'
                  : 'No models discovered'
                : 'Select a model…'}
            </option>
            {models.map((m) => (
              <option key={m.name} value={m.name}>
                {renderModelLabel(m)}
              </option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted pointer-events-none" />
          {loading && (
            <Loader2 className="absolute right-9 top-1/2 -translate-y-1/2 h-4 w-4 text-muted animate-spin" />
          )}
        </div>
      )}

      {!demoMode && errorMsg && !loading && (
        <div className="flex items-start gap-2 text-xs text-score-poor border border-score-poor/20 bg-score-poor/5 rounded-md px-2.5 py-2">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
          <span className="leading-relaxed">{errorMsg}</span>
        </div>
      )}

      {!demoMode && !hasSelection && models.length > 0 && (
        <p className="text-xs text-muted">
          {models.length} model{models.length === 1 ? '' : 's'} available. Pick one to enable live AI.
        </p>
      )}
    </div>
  );
}

function renderModelLabel(m: OllamaModel): string {
  const parts: string[] = [m.name];
  if (m.details?.parameterSize) parts.push(m.details.parameterSize);
  if (m.details?.quantizationLevel) parts.push(m.details.quantizationLevel);
  if (m.size) parts.push(`· ${formatBytes(m.size)}`);
  return parts.join(' ');
}
