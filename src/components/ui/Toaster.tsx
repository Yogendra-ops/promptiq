import { AnimatePresence, motion } from 'framer-motion';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';
import { usePromptStore } from '@/store/usePromptStore';
import { cn } from '@/lib/utils';

export default function Toaster() {
  const toasts = usePromptStore((s) => s.ui.toasts);
  const removeToast = usePromptStore((s) => s.removeToast);

  return (
    <div className="fixed top-4 right-4 z-50 w-[min(92vw,400px)] space-y-2 pointer-events-none">
      <AnimatePresence initial={false}>
        {toasts.map((t) => {
          const Icon =
            t.type === 'success' ? CheckCircle2 : t.type === 'error' ? AlertCircle : Info;
          const iconColor =
            t.type === 'success'
              ? 'text-score-excellent'
              : t.type === 'error'
              ? 'text-score-poor'
              : 'text-accent';
          return (
            <motion.div
              key={t.id}
              layout
              initial={{ opacity: 0, y: -12, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.98 }}
              transition={{ type: 'spring', stiffness: 360, damping: 28 }}
              className={cn(
                'pointer-events-auto card shadow-popover p-3.5 pr-10 flex items-start gap-3 border-l-[3px]',
                t.type === 'success' && 'border-l-score-excellent',
                t.type === 'error' && 'border-l-score-poor',
                t.type === 'info' && 'border-l-accent'
              )}
            >
              <Icon className={cn('h-5 w-5 shrink-0 mt-0.5', iconColor)} />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold text-ink leading-tight">{t.title}</div>
                {t.description && (
                  <div className="mt-0.5 text-sm text-muted leading-relaxed">{t.description}</div>
                )}
              </div>
              <button
                className="absolute top-2.5 right-2.5 h-7 w-7 inline-flex items-center justify-center rounded-md text-muted hover:text-ink hover:bg-border-light transition-colors"
                onClick={() => removeToast(t.id)}
                aria-label="Dismiss"
              >
                <X className="h-4 w-4" />
              </button>
            </motion.div>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
