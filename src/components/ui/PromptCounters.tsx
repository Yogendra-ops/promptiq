import { useMemo } from 'react';
import { Type, AlignLeft, Hash, Pilcrow, MessageSquare, Coins } from 'lucide-react';
import { computeCounters } from '@/lib/utils';

interface Stat {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

export default function PromptCounters({ content }: { content: string }) {
  const counters = useMemo(() => computeCounters(content), [content]);

  const stats: Stat[] = [
    { label: 'Words', value: counters.words, icon: AlignLeft, hint: 'Whitespace-separated tokens' },
    { label: 'Characters', value: counters.characters, icon: Type, hint: 'Including spaces' },
    { label: 'Sentences', value: counters.sentences, icon: MessageSquare, hint: 'Delimited by . ! ?' },
    { label: 'Paragraphs', value: counters.paragraphs, icon: Pilcrow, hint: 'Blank-line separated' },
    { label: 'Est. Tokens', value: counters.estimatedTokens, icon: Coins, hint: 'Rough estimate (0.75 × words + chars/4)' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2">
      {stats.map((s) => (
        <div
          key={s.label}
          className="border border-border rounded-lg bg-white px-3 py-2.5 flex items-center gap-2.5"
          title={s.hint}
        >
          <div className="h-8 w-8 rounded-md bg-border-light text-muted flex items-center justify-center shrink-0">
            <s.icon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <div className="text-[11px] uppercase tracking-wider text-muted font-medium">
              {s.label}
            </div>
            <div className="text-lg font-semibold tabular-nums text-ink leading-none mt-0.5">
              {s.value.toLocaleString()}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
