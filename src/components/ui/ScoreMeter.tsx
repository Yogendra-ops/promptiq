import { cn, scoreTier } from '@/lib/utils';

export function ScoreMeter({
  score,
  max = 10,
  weight,
  label,
  description,
  compact = false,
}: {
  score: number;
  max?: number;
  weight?: number;
  label: string;
  description?: string;
  compact?: boolean;
}) {
  const pct = Math.max(0, Math.min(100, (score / max) * 100));
  const tier = scoreTier(score);
  const track =
    tier === 'excellent'
      ? 'bg-score-excellent'
      : tier === 'good'
      ? 'bg-score-good'
      : tier === 'fair'
      ? 'bg-score-fair'
      : 'bg-score-poor';
  const text =
    tier === 'excellent'
      ? 'text-score-excellent'
      : tier === 'good'
      ? 'text-score-good'
      : tier === 'fair'
      ? 'text-score-fair'
      : 'text-score-poor';

  return (
    <div className={cn('space-y-2', compact ? 'py-1' : 'py-2')}>
      <div className="flex items-baseline justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-ink">{label}</span>
            {typeof weight === 'number' && (
              <span className="chip text-[10px] py-0 px-2 h-5">
                {Math.round(weight * 100)}% weight
              </span>
            )}
          </div>
          {description && !compact && (
            <p className="mt-0.5 text-xs text-muted leading-relaxed">{description}</p>
          )}
        </div>
        <div className="text-right shrink-0">
          <div className={cn('text-lg font-semibold tabular-nums', text)}>
            {score.toFixed(1)}
            <span className="text-xs text-muted font-normal"> /{max}</span>
          </div>
        </div>
      </div>
      <div className={cn(compact ? 'h-1.5' : 'h-2', 'w-full rounded-full bg-border overflow-hidden')}>
        <div
          className={cn('h-full rounded-full animate-meter-fill', track)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}

export function OverallScoreBadge({ score, size = 'md' }: { score: number; size?: 'sm' | 'md' | 'lg' }) {
  const tier = scoreTier(score);
  const ring =
    tier === 'excellent'
      ? 'ring-score-excellent/20 bg-score-excellent/5 text-score-excellent'
      : tier === 'good'
      ? 'ring-score-good/20 bg-score-good/5 text-score-good'
      : tier === 'fair'
      ? 'ring-score-fair/20 bg-score-fair/5 text-score-fair'
      : 'ring-score-poor/20 bg-score-poor/5 text-score-poor';
  const sz =
    size === 'lg'
      ? 'h-24 w-24 text-3xl'
      : size === 'sm'
      ? 'h-12 w-12 text-base'
      : 'h-16 w-16 text-2xl';
  const tierLabel = { excellent: 'Excellent', good: 'Good', fair: 'Fair', poor: 'Needs Work' }[tier];
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={cn(
          sz,
          'rounded-full flex items-center justify-center font-serif font-semibold ring-2 tabular-nums',
          ring
        )}
      >
        {score.toFixed(1)}
      </div>
      <div className="text-xs font-medium text-ink/80">{tierLabel}</div>
    </div>
  );
}
