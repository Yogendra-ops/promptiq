import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Search, ArrowRight, FileText, FlaskConical, Scale, GitCompare, LibraryBig, LayoutTemplate, Settings, CircleDot, Sparkles, CornerDownLeft } from 'lucide-react';
import { usePromptStore } from '@/store/usePromptStore';
import { NAV_ITEMS } from '@/components/layout/navConfig';
import { DEMO_TEMPLATES } from '@/lib/demoData';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  hint?: string;
  group: 'Navigate' | 'Actions' | 'Prompts' | 'Templates';
  icon: React.ComponentType<{ className?: string }>;
  run: () => void;
}

export default function CommandPalette() {
  const open = usePromptStore((s) => s.ui.commandPaletteOpen);
  const close = usePromptStore((s) => s.closeCommandPalette);
  const upsertPrompt = usePromptStore((s) => s.upsertPrompt);
  const prompts = usePromptStore((s) => s.prompts);
  const toggleDemo = usePromptStore((s) => s.toggleDemoMode);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const pushToast = usePromptStore((s) => s.pushToast);
  const openLab = usePromptStore((s) => s.setComparison);
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const items = useMemo<CommandItem[]>(() => {
    const nav: CommandItem[] = NAV_ITEMS.map((n) => ({
      id: `nav-${n.id}`,
      label: `Go to ${n.label}`,
      hint: n.hint,
      group: 'Navigate',
      icon: n.icon,
      run: () => {
        navigate(n.path);
        close();
      },
    }));

    const actions: CommandItem[] = [
      {
        id: 'act-new-prompt',
        label: 'Create New Prompt',
        hint: 'Add a blank prompt to your library',
        group: 'Actions',
        icon: FileText,
        run: () => {
          const p = upsertPrompt({ title: 'Untitled Prompt', content: '' });
          navigate(`/lab?prompt=${p.id}`);
          close();
        },
      },
      {
        id: 'act-demo-toggle',
        label: demoMode ? 'Disable Demo Mode' : 'Enable Demo Mode',
        hint: 'Use sample evaluations without Ollama',
        group: 'Actions',
        icon: Sparkles,
        run: () => {
          toggleDemo();
          pushToast({
            type: 'info',
            title: !demoMode ? 'Demo Mode enabled' : 'Demo Mode disabled',
            description: !demoMode ? 'All AI calls will return sample results.' : 'Live AI calls via Ollama when available.',
          });
          close();
        },
      },
      {
        id: 'act-run-evaluator',
        label: 'Run Evaluator on Active Prompt',
        hint: 'Jump to Evaluator with the last active prompt',
        group: 'Actions',
        icon: Scale,
        run: () => {
          navigate('/evaluator');
          close();
        },
      },
      {
        id: 'act-open-settings',
        label: 'Open Settings',
        hint: 'Ollama URL, model, preferences',
        group: 'Actions',
        icon: Settings,
        run: () => {
          navigate('/settings');
          close();
        },
      },
    ];

    const promptCmds: CommandItem[] = prompts.slice(0, 20).map((p) => ({
      id: `prompt-${p.id}`,
      label: p.title,
      hint: p.category,
      group: 'Prompts',
      icon: FlaskConical,
      run: () => {
        navigate(`/lab?prompt=${p.id}`);
        close();
      },
    }));

    const templateCmds: CommandItem[] = DEMO_TEMPLATES.map((t) => ({
      id: `tpl-${t.id}`,
      label: t.name,
      hint: t.category,
      group: 'Templates',
      icon: LayoutTemplate,
      run: () => {
        navigate(`/templates#${t.id}`);
        close();
      },
    }));

    return [...nav, ...actions, ...promptCmds, ...templateCmds];
  }, [prompts, demoMode, navigate, close, upsertPrompt, toggleDemo, pushToast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.label.toLowerCase().includes(q) ||
        i.hint?.toLowerCase().includes(q) ||
        i.group.toLowerCase().includes(q)
    );
  }, [items, query]);

  const grouped = useMemo(() => {
    const g = new Map<string, CommandItem[]>();
    for (const item of filtered) {
      const list = g.get(item.group) ?? [];
      list.push(item);
      g.set(item.group, list);
    }
    return Array.from(g.entries());
  }, [filtered]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!open) return;
      if (e.key === 'Escape') {
        close();
        return;
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setSelectedIndex((i) => Math.min(i + 1, filtered.length - 1));
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setSelectedIndex((i) => Math.max(i - 1, 0));
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        const item = filtered[selectedIndex];
        if (item) item.run();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close, filtered, selectedIndex]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-ink/30 backdrop-blur-sm"
            onClick={close}
          />
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 340, damping: 28 }}
            className="fixed top-[5vh] sm:top-[8vh] left-1/2 -translate-x-1/2 z-[70] w-[min(94vw,720px)] card shadow-popover overflow-hidden"
          >
            <div className="flex items-center gap-3 px-4 h-14 border-b border-border">
              <Search className="h-[18px] w-[18px] text-muted" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search or run a command…"
                className="flex-1 h-full text-sm bg-transparent outline-none placeholder:text-muted"
              />
              <div className="hidden sm:flex items-center gap-1 text-[10px] font-mono text-muted">
                <kbd className="px-1.5 py-0.5 rounded border border-border bg-border-light">esc</kbd>
                <span>to close</span>
              </div>
            </div>
            <div className="max-h-[60vh] overflow-y-auto scrollbar-thin p-2">
              {grouped.length === 0 ? (
                <div className="px-4 py-10 text-center text-muted text-sm">
                  No matches for <span className="font-mono text-ink">“{query}”</span>
                </div>
              ) : (
                grouped.map(([group, list]) => (
                  <div key={group} className="mb-2 last:mb-0">
                    <div className="section-title px-3 py-1.5">{group}</div>
                    <ul className="space-y-0.5">
                      {list.map((item) => {
                        const flatIndex = filtered.findIndex((f) => f.id === item.id);
                        const isSelected = flatIndex === selectedIndex;
                        return (
                          <li key={item.id}>
                            <button
                              onClick={item.run}
                              onMouseEnter={() => setSelectedIndex(flatIndex)}
                              className={cn(
                                'w-full flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors group',
                                isSelected ? 'bg-accent/10 text-accent' : 'hover:bg-border-light'
                              )}
                            >
                              <div className={cn(
                                'h-8 w-8 rounded-md border flex items-center justify-center shrink-0',
                                isSelected ? 'border-accent/30 bg-accent/5' : 'border-border bg-white'
                              )}>
                                <item.icon className={cn(
                                  'h-4 w-4 transition-colors',
                                  isSelected ? 'text-accent' : 'text-muted group-hover:text-accent'
                                )} />
                              </div>
                              <div className="flex-1 min-w-0 text-left">
                                <div className={cn('truncate', isSelected ? 'text-accent' : 'text-ink')}>{item.label}</div>
                                {item.hint && (
                                  <div className="text-xs text-muted truncate">{item.hint}</div>
                                )}
                              </div>
                              <ArrowRight className={cn(
                                'h-4 w-4 transition-opacity',
                                isSelected ? 'text-accent opacity-100' : 'text-muted opacity-0 group-hover:opacity-100'
                              )} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                ))
              )}
            </div>
            <div className="flex items-center justify-between gap-3 px-4 h-11 border-t border-border text-[11px] text-muted bg-border-light/40">
              <div className="flex items-center gap-3">
                <span className="flex items-center gap-1">
                  <CornerDownLeft className="h-3 w-3" /> to select
                </span>
                <span className="flex items-center gap-1">↑↓ navigate</span>
              </div>
              <span className="flex items-center gap-2">
                <CircleDot className="h-3 w-3 text-accent" />
                <span>{filtered.length} result{filtered.length === 1 ? '' : 's'}</span>
              </span>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
