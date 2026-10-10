import { useLocation, useNavigate } from 'react-router-dom';
import { Layers as BCIcon, ChevronRight, Home, Menu, Search, AlertTriangle, Cpu, Sparkles } from 'lucide-react';
import { NAV_ITEMS, BREADCRUMB_LABELS, pageFromPath, BRAND } from './navConfig';
import { usePromptStore } from '@/store/usePromptStore';
import { cn } from '@/lib/utils';

export function TopNav() {
  const location = useLocation();
  const navigate = useNavigate();
  const page = pageFromPath(location.pathname);
  const navItem = NAV_ITEMS.find((n) => n.id === page);
  const toggleMobile = usePromptStore((s) => s.toggleMobileSidebar);
  const openPalette = usePromptStore((s) => s.openCommandPalette);
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const connectionStatus = usePromptStore((s) => s.settings.ollama.connectionStatus);
  const selectedModel = usePromptStore((s) => s.settings.ollama.selectedModel);
  const toggleDemo = usePromptStore((s) => s.toggleDemoMode);
  const pushToast = usePromptStore((s) => s.pushToast);

  return (
    <header className="sticky top-0 z-20 h-16 bg-bg/80 backdrop-blur border-b border-border">
      <div className="flex items-center gap-3 px-4 lg:px-6 h-full">
        <button
          className="lg:hidden btn-ghost p-2 h-9 w-9"
          onClick={() => toggleMobile(true)}
          aria-label="Open sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <div className="flex items-center gap-2 text-muted">
          <BCIcon className="h-4 w-4" />
          <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
            <a href="/" className="text-muted hover:text-ink transition-colors flex items-center gap-1">
              <Home className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Workspace</span>
            </a>
            <ChevronRight className="h-3.5 w-3.5" />
            <span className="text-ink font-medium">{BREADCRUMB_LABELS[page]}</span>
          </nav>
        </div>

        <div className="ml-auto flex items-center gap-3">
          <button
            onClick={openPalette}
            className="hidden md:flex items-center gap-3 px-3.5 py-1.5 h-9 border border-border rounded-md bg-white text-muted text-sm hover:border-accent/40 hover:text-ink transition-colors w-80 max-w-[28vw]"
          >
            <Search className="h-4 w-4" />
            <span className="flex-1 text-left">Search commands, prompts…</span>
            <kbd className="text-[10px] font-mono border border-border rounded px-1.5 py-0.5 bg-border-light text-muted">
              ⌘K
            </kbd>
          </button>
          <button
            onClick={openPalette}
            className="md:hidden btn-ghost p-2 h-9 w-9"
            aria-label="Search"
          >
            <Search className="h-4.5 w-4.5 h-[18px] w-[18px]" />
          </button>
          {(() => {
            if (demoMode) {
              return (
                <button
                  type="button"
                  onClick={() => {
                    toggleDemo();
                    pushToast({ type: 'info', title: 'Demo Mode turned off', description: 'Now using live local Ollama evaluations.' });
                  }}
                  className={cn(
                    'hidden sm:flex items-center gap-2 px-3 py-1.5 h-9 rounded-full text-xs font-medium border transition-colors',
                    'bg-accent/5 border-accent/20 text-accent hover:bg-accent/10 hover:border-accent/40 cursor-pointer'
                  )}
                  title="Demo Mode — click to turn off and use your local Ollama model."
                >
                  <Sparkles className="h-3.5 w-3.5" />
                  Demo Mode · click to use live
                </button>
              );
            }
            const connected = connectionStatus === 'connected';
            const hasModel = !!selectedModel;
            const allGood = connected && hasModel;
            let cls = '';
            let label = '';
            let tooltip = '';
            let Icon: any = Cpu;
            if (allGood) {
              cls = 'bg-border-light border-border text-ink/80 hover:border-accent/30 hover:bg-white cursor-pointer';
              label = `Live · ${selectedModel.split(':')[0]}`;
              tooltip = `Evaluating with ${selectedModel}. Click to open Settings.`;
            } else if (connectionStatus === 'checking') {
              cls = 'bg-score-fair/5 border-score-fair/20 text-score-fair cursor-default';
              label = 'Checking Ollama…';
              tooltip = 'Scanning for a running Ollama server.';
            } else {
              cls = 'bg-score-fair/5 border-score-fair/20 text-score-fair hover:bg-score-fair/10 cursor-pointer';
              if (!connected) {
                label = '⚠ Ollama offline';
                tooltip = 'No running Ollama server detected. Click to open Settings.';
                Icon = AlertTriangle;
              } else {
                label = '⚠ Select a model';
                tooltip = 'Connected but no model selected. Click to open Settings.';
                Icon = AlertTriangle;
              }
            }
            return (
              <button
                type="button"
                onClick={() => !allGood && navigate('/settings')}
                className={cn(
                  'hidden sm:flex items-center gap-2 px-3 py-1.5 h-9 rounded-full text-xs font-medium border transition-colors',
                  cls
                )}
                title={tooltip}
              >
                <Icon className={cn('h-3.5 w-3.5', connectionStatus === 'checking' && 'animate-spin')} />
                <span className="truncate max-w-[200px]">{label}</span>
              </button>
            );
          })()}
        </div>
      </div>
    </header>
  );
}

export function PageHeader({
  title,
  subtitle,
  actions,
  eyebrow,
}: {
  title: string;
  subtitle?: string;
  actions?: React.ReactNode;
  eyebrow?: string;
}) {
  return (
    <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 pb-6 border-b border-border mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="section-title mb-2">{eyebrow}</div>}
        <h1 className="heading-xl">{title}</h1>
        {subtitle && <p className="mt-2 text-muted max-w-2xl leading-relaxed">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2 md:justify-end">{actions}</div>}
    </div>
  );
}
