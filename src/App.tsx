import { useEffect } from 'react';
import { HashRouter, Navigate, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { useStore } from './store';
import { Spinner } from './app/ui';
import { Dashboard } from './features/tracker/Dashboard';
import { CharacterPage, CharacterList } from './features/tracker/CharacterPage';
import { Legion } from './features/tracker/Legion';
import { Fashion } from './features/tracker/Fashion';
import { Checklist } from './features/bossing/Checklist';
import { Assignments } from './features/bossing/Assignments';
import { History } from './features/bossing/History';
import { Summary } from './features/bossing/Summary';
import { Board } from './features/ideas/Board';
import { Settings } from './features/settings/Settings';

export default function App() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const init = useStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);

  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {!ready ? (
            <Route path="*" element={error ? <div className="card p-6 text-bad text-sm">Failed to load: {error}</div> : <Spinner label="Loading data…" />} />
          ) : (
            <>
              <Route index element={<Dashboard />} />
              <Route path="characters" element={<CharacterList />} />
              <Route path="character/:name" element={<CharacterPage />} />
              <Route path="legion" element={<Legion />} />
              <Route path="fashion" element={<Fashion />} />
              <Route path="bossing" element={<Checklist />} />
              <Route path="bossing/assignments" element={<Assignments />} />
              <Route path="bossing/history" element={<History />} />
              <Route path="bossing/summary" element={<Summary />} />
              <Route path="ideas" element={<Board />} />
              <Route path="settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </>
          )}
        </Route>
      </Routes>
    </HashRouter>
  );
}
