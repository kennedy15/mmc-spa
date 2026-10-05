import { useEffect } from 'react';
import { HashRouter, Navigate, Outlet, Route, Routes } from 'react-router-dom';
import { Layout } from './app/Layout';
import { useStore } from './store';
import { Spinner } from './app/ui';
import { Dashboard } from './features/tracker/Dashboard';
import { CharacterPage, CharacterList } from './features/tracker/CharacterPage';
import { Legion } from './features/tracker/Legion';
import { Fashion } from './features/tracker/Fashion';
import { Checklist } from './features/bossing/Checklist';
import { Assignments } from './features/bossing/Assignments';
import { Presets } from './features/bossing/Presets';
import { History } from './features/bossing/History';
import { Summary } from './features/bossing/Summary';
import { ClassicBuilds } from './features/classic/Builds';
import { BuildPage } from './features/classic/BuildPage';
import { GrindingSpots } from './features/classic/Grinding';
import { SkillBuilderPage } from './features/classic/SkillBuilder';
import { CharacterLookupPage } from './features/classic/CharacterLookup';
import { Board } from './features/ideas/Board';
import { Settings } from './features/settings/Settings';

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<Layout />}>
          {/* Classic World pages read only public/classic*.json, so they open without waiting for the tracker's data. */}
          <Route path="classic" element={<Navigate to="/classic/builds" replace />} />
          <Route path="classic/builds" element={<ClassicBuilds />} />
          <Route path="classic/builds/:id" element={<BuildPage />} />
          <Route path="classic/grinding" element={<GrindingSpots />} />
          <Route path="classic/skills" element={<SkillBuilderPage />} />
          <Route path="classic/characters" element={<CharacterLookupPage />} />
          <Route element={<TrackerData />}>
            <Route index element={<Dashboard />} />
            <Route path="characters" element={<CharacterList />} />
            <Route path="character/:name" element={<CharacterPage />} />
            <Route path="legion" element={<Legion />} />
            <Route path="fashion" element={<Fashion />} />
            <Route path="bossing" element={<Checklist />} />
            <Route path="bossing/assignments" element={<Assignments />} />
            <Route path="bossing/presets" element={<Presets />} />
            <Route path="bossing/history" element={<History />} />
            <Route path="bossing/summary" element={<Summary />} />
            <Route path="ideas" element={<Board />} />
            <Route path="settings" element={<Settings />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

/** Every other page needs the snapshots and saved data (store.init), loaded on the first visit to one of them. */
function TrackerData() {
  const ready = useStore((s) => s.ready);
  const error = useStore((s) => s.error);
  const init = useStore((s) => s.init);
  useEffect(() => {
    void init();
  }, [init]);
  if (error) return <div className="card p-6 text-bad text-sm">Failed to load: {error}</div>;
  return ready ? <Outlet /> : <Spinner label="Loading data…" />;
}
