import { NavLink, Outlet } from 'react-router-dom';
import { useStore } from '../store';
import { relTime } from './format';

const NAV: { to: string; label: string; end?: boolean }[][] = [
  [
    { to: '/', label: 'Dashboard', end: true },
    { to: '/characters', label: 'Characters' },
    { to: '/legion', label: 'Legion' },
    { to: '/fashion', label: 'Fashion' },
  ],
  [
    { to: '/bossing', label: 'Checklist', end: true },
    { to: '/bossing/assignments', label: 'Assignments' },
    { to: '/bossing/history', label: 'History' },
    { to: '/bossing/summary', label: 'Summary' },
  ],
  [{ to: '/ideas', label: 'Build board' }],
  [{ to: '/settings', label: 'Settings' }],
];
const GROUPS = ['Tracker', 'Bossing', 'Minecraft', ''];

export function Layout() {
  const index = useStore((s) => s.index);
  const folder = useStore((s) => s.folder);
  const grantFolder = useStore((s) => s.grantFolder);
  const updated = index?.updatedAt ?? null;
  const stale = updated ? Date.now() - Date.parse(updated) > 36 * 3_600_000 : true;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r border-border bg-surface/60 lg:sticky lg:top-0 lg:h-screen flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
            <rect width="32" height="32" rx="7" fill="#1b1e24" />
            <path d="M16 5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L16 18.4l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" fill="#ff7a1a" />
            <rect x="15" y="20" width="2" height="7" rx="1" fill="#ff7a1a" />
          </svg>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">MapleTracker</div>
            <div className="text-[11px] text-ink-3">+ Build Board</div>
          </div>
        </div>
        <nav className="px-3 pb-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {NAV.map((group, gi) => (
            <div key={gi} className="flex lg:flex-col gap-0.5 lg:mb-3 shrink-0">
              {GROUPS[gi] && <div className="hidden lg:block label px-3 pt-1 pb-1.5">{GROUPS[gi]}</div>}
              {group.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${isActive ? 'bg-accent/15 text-accent font-medium' : 'text-ink-2 hover:text-ink hover:bg-surface-2'}`}
                >
                  {item.label}
                </NavLink>
              ))}
            </div>
          ))}
        </nav>
        <div className="mt-auto px-5 py-4 text-xs text-ink-3 space-y-1.5 hidden lg:block border-t border-border">
          <div className="flex items-center gap-2">
            <span className={`inline-block size-1.5 rounded-full ${stale ? 'bg-warn' : 'bg-good'}`} />
            Data {updated ? relTime(updated) : 'not yet collected'}
          </div>
          <div className="flex items-center gap-2">
            <span className={`inline-block size-1.5 rounded-full ${folder.connected ? 'bg-good' : folder.needsPermission ? 'bg-warn' : 'bg-ink-3'}`} />
            {folder.connected ? `Folder: ${folder.name}` : folder.needsPermission ? (
              <button className="underline hover:text-ink" onClick={() => void grantFolder()}>
                Reconnect folder
              </button>
            ) : (
              'Browser storage only'
            )}
          </div>
        </div>
      </aside>
      <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7 max-w-[1400px] w-full">
        <Outlet />
      </main>
    </div>
  );
}
