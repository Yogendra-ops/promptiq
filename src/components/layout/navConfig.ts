import {
  LayoutDashboard,
  Scale,
  GitCompare,
  FlaskConical,
  LibraryBig,
  LayoutTemplate,
  Settings as SettingsIcon,
  Sparkles,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppPage } from '@/types';

export interface NavItem {
  id: AppPage;
  label: string;
  path: string;
  icon: LucideIcon;
  hint?: string;
}

export const NAV_ITEMS: NavItem[] = [
  { id: 'overview', label: 'Overview', path: '/', icon: LayoutDashboard, hint: 'Dashboard + quick start' },
  { id: 'evaluator', label: 'Evaluator', path: '/evaluator', icon: Scale, hint: 'Score prompts across 5 dimensions' },
  { id: 'compare', label: 'Compare', path: '/compare', icon: GitCompare, hint: 'Original vs improved side-by-side' },
  { id: 'lab', label: 'Prompt Lab', path: '/lab', icon: FlaskConical, hint: 'Editor workspace' },
  { id: 'prompts', label: 'My Prompts', path: '/prompts', icon: LibraryBig, hint: 'Saved prompt library' },
  { id: 'templates', label: 'Templates', path: '/templates', icon: LayoutTemplate, hint: 'Reusable prompt templates' },
  { id: 'settings', label: 'Settings', path: '/settings', icon: SettingsIcon, hint: 'Ollama + preferences' },
];

export const BREADCRUMB_LABELS: Record<AppPage, string> = {
  overview: 'Overview',
  evaluator: 'Evaluator',
  compare: 'Compare',
  lab: 'Prompt Lab',
  prompts: 'My Prompts',
  templates: 'Templates',
  settings: 'Settings',
};

export function pageFromPath(pathname: string): AppPage {
  const clean = pathname.replace(/\/+$/, '') || '/';
  if (clean === '/') return 'overview';
  const match = NAV_ITEMS.find((n) => n.path === clean);
  return match?.id ?? 'overview';
}

export const BRAND = {
  name: 'PromptIQ',
  tagline: 'Make Every Prompt Count',
  version: 'Enterprise 2.0',
  icon: Sparkles,
};
