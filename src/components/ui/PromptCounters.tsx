import { useMemo } from 'react';
import { Type, AlignLeft, Hash, Pilcrow, MessageSquare, Coins } from 'lucide-react';
import { computeCounters } from '@/lib/utils';

interface Stat {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
  hint?: string;
}

export default function PromptCounters({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  const counters = useMemo(() => computeCounters(content), [content]);

  const stats: Stat[] = [
    { label: 'Words', value: counters.words, icon: AlignLeft, hint: 'Whitespace-separated tokens' },
    { label: 'Characters', value: counters.characters, icon: Type, hint: 'Including spaces' },
    { label: 'Sentences', value: counters.sentences, icon: MessageSquare, hint: 'Delimited by . ! ?' },
    { label: 'Paragraphs', value: counters.paragraphs, icon: Pilcrow, hint: 'Blank-line separated' },
    { label: 'Est. Tokens', value: counters.estimatedTokens, icon: Coins, hint: 'Rough estimate (0.75 × words + chars/4)' },
  ];

  return (
    <div className={className ?? 'grid grid-cols-2 min-[440px]:grid-cols-3 xl:grid-cols-5 gap-2.5'}>
      {stats.map((s) => (
        <div
          key={s.label}
          className="border border-border rounded-lg bg-white p-3 flex flex-col justify-between min-w-0 hover:border-border-dark/60 transition-colors"
          title={s.hint}
        >
          <div className="flex items-center justify-between gap-1.5 mb-1.5 min-w-0">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-muted truncate">
              {s.label}
            </span>
            <s.icon className="h-3.5 w-3.5 text-muted/60 shrink-0" />
          </div>
          <div className="text-lg sm:text-xl font-bold font-serif tabular-nums text-ink leading-tight">
            {s.value.toLocaleString()}
          </div>
        </div>
      ))}
    </div>
  );
}
