import { Routes, Route, Navigate } from 'react-router-dom';
import AppLayout from '@/components/layout/AppLayout';
import Overview from '@/pages/Overview';
import Evaluator from '@/pages/Evaluator';
import Compare from '@/pages/Compare';
import Lab from '@/pages/Lab';
import Prompts from '@/pages/Prompts';
import Templates from '@/pages/Templates';
import Settings from '@/pages/Settings';
import Toaster from '@/components/ui/Toaster';
import CommandPalette from '@/components/ui/CommandPalette';

export default function App() {
  return (
    <AppLayout>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/evaluator" element={<Evaluator />} />
        <Route path="/compare" element={<Compare />} />
        <Route path="/lab" element={<Lab />} />
        <Route path="/prompts" element={<Prompts />} />
        <Route path="/templates" element={<Templates />} />
        <Route path="/settings" element={<Settings />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <CommandPalette />
      <Toaster />
    </AppLayout>
  );
}
