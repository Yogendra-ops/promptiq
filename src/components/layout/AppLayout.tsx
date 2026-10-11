import { PropsWithChildren, useEffect } from 'react';
import Sidebar from './Sidebar';
import { TopNav } from './TopNav';
import { usePromptStore } from '@/store/usePromptStore';
import { useLocation } from 'react-router-dom';
import { pageFromPath, BRAND } from './navConfig';

export default function AppLayout({ children }: PropsWithChildren) {
  const hydrate = usePromptStore((s) => s.hydrate);
  const updateSettings = usePromptStore((s) => s.updateSettings);
  const discoverModels = usePromptStore((s) => s.discoverModels);
  const settings = usePromptStore((s) => s.settings);
  const togglePalette = usePromptStore((s) => s.toggleCommandPalette);
  const location = useLocation();

  useEffect(() => {
    hydrate();
    // Once, in the background, try to discover models if not in demo mode.
    const t = setTimeout(() => {
      if (!usePromptStore.getState().settings.demoMode) {
        discoverModels().catch(() => {});
      }
    }, 400);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const page = pageFromPath(location.pathname);
    if (page !== settings.lastOpenedPage) {
      updateSettings({ lastOpenedPage: page });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.pathname]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        togglePalette();
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [togglePalette]);

  return (
    <div className="min-h-screen flex bg-bg text-ink">
      <Sidebar />
      <div className="flex-1 min-w-0 flex flex-col overflow-x-clip">
        <TopNav />
        <main className="flex-1 px-4 lg:px-8 py-6 lg:py-8 max-w-[1600px] w-full mx-auto">
          {children}
        </main>
        <footer className="px-4 lg:px-8 py-5 border-t border-border text-xs text-muted flex flex-wrap items-center justify-between gap-3 max-w-[1600px] w-full mx-auto">
          <div>
            <span className="font-semibold text-ink/80">{BRAND.name} {BRAND.version}</span>
            <span className="mx-2">·</span>
            {BRAND.tagline}
          </div>
          <div>All data stored locally in your browser.</div>
        </footer>
      </div>
    </div>
  );
}
