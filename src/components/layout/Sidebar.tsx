import { NavLink, useLocation } from 'react-router-dom';
import { X, CircleDot, Wifi, WifiOff } from 'lucide-react';
import { usePromptStore } from '@/store/usePromptStore';
import { NAV_ITEMS, BRAND } from './navConfig';
import { cn } from '@/lib/utils';

export default function Sidebar() {
  const location = useLocation();
  const demoMode = usePromptStore((s) => s.settings.demoMode);
  const connStatus = usePromptStore((s) => s.settings.ollama.connectionStatus);
  const mobileOpen = usePromptStore((s) => s.ui.mobileSidebarOpen);
  const toggleMobile = usePromptStore((s) => s.toggleMobileSidebar);

  const BrandIcon = BRAND.icon;

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-30 bg-ink/20 backdrop-blur-sm lg:hidden"
          onClick={() => toggleMobile(false)}
          role="button"
          aria-label="Close sidebar"
        />
      )}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-40 w-72 border-r border-border bg-white transition-transform duration-200 lg:translate-x-0 lg:static lg:z-0 flex flex-col',
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="flex items-center justify-between px-5 h-16 border-b border-border">
          <div className="flex items-center gap-2.5">
            <div className="h-9 w-9 rounded-lg bg-accent text-white flex items-center justify-center">
              <BrandIcon className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <div className="leading-tight">
              <div className="font-semibold text-ink tracking-tight">{BRAND.name}</div>
              <div className="text-[11px] text-muted">{BRAND.version}</div>
            </div>
          </div>
          <button
            className="lg:hidden btn-ghost px-2 py-1 h-8 w-8"
            onClick={() => toggleMobile(false)}
            aria-label="Close sidebar"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto scrollbar-thin px-3 py-4">
          <div className="section-title px-2 mb-2">Workspace</div>
          <ul className="space-y-0.5">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.path === '/'
                  ? location.pathname === '/'
                  : location.pathname.startsWith(item.path);
              return (
                <li key={item.id}>
                  <NavLink
                    to={item.path}
                    onClick={() => toggleMobile(false)}
                    className={cn(
                      'group flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-colors',
                      active
                        ? 'bg-accent/10 text-accent'
                        : 'text-ink/80 hover:bg-border-light hover:text-ink'
                    )}
                  >
                    <Icon
                      className={cn('h-[18px] w-[18px]', active ? 'text-accent' : 'text-muted')}
                      strokeWidth={active ? 2.25 : 2}
                    />
                    <span className="flex-1">{item.label}</span>
                    {active && <CircleDot className="h-3 w-3 text-accent" />}
                  </NavLink>
                </li>
              );
            })}
          </ul>
        </nav>

        <div className="px-4 py-4 border-t border-border space-y-2">
          {demoMode ? (
            <div className="flex items-start gap-2 px-3 py-2.5 rounded-lg border border-accent/20 bg-accent/5">
              <SparkleBadge />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-accent">Demo Mode Active</div>
                <div className="text-[11px] text-muted leading-snug">
                  Sample evaluations. Connect Ollama for live AI.
                </div>
              </div>
            </div>
          ) : (
            <div
              className={cn(
                'flex items-start gap-2 px-3 py-2.5 rounded-lg border',
                connStatus === 'connected'
                  ? 'border-score-excellent/20 bg-score-excellent/5'
                  : connStatus === 'checking'
                  ? 'border-score-fair/20 bg-score-fair/5'
                  : 'border-score-poor/20 bg-score-poor/5'
              )}
            >
              {connStatus === 'connected' ? (
                <Wifi className="h-4 w-4 text-score-excellent mt-0.5 shrink-0" />
              ) : connStatus === 'checking' ? (
                <Wifi className="h-4 w-4 text-score-fair mt-0.5 shrink-0 animate-pulse" />
              ) : (
                <WifiOff className="h-4 w-4 text-score-poor mt-0.5 shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div
                  className={cn(
                    'text-xs font-semibold',
                    connStatus === 'connected'
                      ? 'text-score-excellent'
                      : connStatus === 'checking'
                      ? 'text-score-fair'
                      : 'text-score-poor'
                  )}
                >
                  {connStatus === 'connected'
                    ? 'Ollama Connected'
                    : connStatus === 'checking'
                    ? 'Checking Ollama…'
                    : 'Ollama Unavailable'}
                </div>
                <div className="text-[11px] text-muted leading-snug truncate">
                  {usePromptStore.getState().settings.ollama.baseUrl}
                </div>
              </div>
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function SparkleBadge() {
  return (
    <div className="h-5 w-5 rounded-full bg-accent/15 flex items-center justify-center shrink-0 mt-0.5">
      <div className="h-2.5 w-2.5 rounded-full bg-accent flex items-center justify-center">
        <span className="text-white text-[8px] leading-none">★</span>
      </div>
    </div>
  );
}
