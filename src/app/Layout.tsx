import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useStore } from '../store';
import { relTime } from './format';
import { setTheme, THEMES, useTheme } from './theme';

interface NavItem {
  to: string;
  label: string;
  end?: boolean;
}
interface NavSection {
  label?: string;
  groups: { label?: string; items: NavItem[] }[];
}

/** Sidebar sections, top to bottom: today's GMS (tracker and bossing), Classic World guides, Minecraft, then Settings. */
const NAV: NavSection[] = [
  {
    label: 'Modern Maple',
    groups: [
      {
        label: 'Tracker',
        items: [
          { to: '/', label: 'Dashboard', end: true },
          { to: '/characters', label: 'Characters' },
          { to: '/legion', label: 'Legion' },
          { to: '/fashion', label: 'Fashion' },
        ],
      },
      {
        label: 'Bossing',
        items: [
          { to: '/bossing', label: 'Checklist', end: true },
          { to: '/bossing/assignments', label: 'Assignments' },
          { to: '/bossing/presets', label: 'Presets' },
          { to: '/bossing/history', label: 'History' },
          { to: '/bossing/summary', label: 'Summary' },
        ],
      },
    ],
  },
  {
    label: 'Classic Maple',
    groups: [
      {
        items: [
          { to: '/classic/builds', label: 'Class builds' },
          { to: '/classic/grinding', label: 'Grinding spots' },
        ],
      },
    ],
  },
  { label: 'Minecraft', groups: [{ items: [{ to: '/ideas', label: 'Build board' }] }] },
  { groups: [{ items: [{ to: '/settings', label: 'Settings' }] }] },
];

export function Layout() {
  const index = useStore((s) => s.index);
  const folder = useStore((s) => s.folder);
  const grantFolder = useStore((s) => s.grantFolder);
  const classic = useLocation().pathname.startsWith('/classic');
  const updated = index?.updatedAt ?? null;
  const stale = updated ? Date.now() - Date.parse(updated) > 36 * 3_600_000 : true;

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[220px_1fr]">
      <aside className="border-b lg:border-b-0 lg:border-r border-border bg-surface/60 lg:sticky lg:top-0 lg:h-screen flex flex-col">
        <div className="flex items-center gap-2.5 px-5 py-4">
          <svg viewBox="0 0 32 32" className="size-7" aria-hidden>
            <rect width="32" height="32" rx="7" className="fill-surface-2" />
            <path d="M16 5l2.6 5.4 5.9.8-4.3 4.1 1 5.9L16 18.4l-5.2 2.8 1-5.9-4.3-4.1 5.9-.8z" className="fill-accent" />
            <rect x="15" y="20" width="2" height="7" rx="1" className="fill-accent-alt" />
          </svg>
          <div className="leading-tight">
            <div className="font-semibold tracking-tight">MapleTracker</div>
            <div className="text-[11px] text-ink-3">+ Build Board</div>
          </div>
        </div>
        <nav className="px-3 pb-3 flex lg:flex-col gap-1 overflow-x-auto lg:overflow-visible">
          {NAV.map((section, si) => (
            <div key={si} className="flex lg:flex-col gap-1 lg:gap-2 lg:mb-4 shrink-0 border-border max-lg:not-first:border-l max-lg:not-first:pl-1">
              {section.label && (
                <div className="hidden lg:flex items-center gap-2 px-3 pt-1">
                  <span className="label text-ink-2 font-semibold">{section.label}</span>
                  <span className="h-px flex-1 bg-border" aria-hidden />
                </div>
              )}
              {section.groups.map((group, gi) => (
                <div key={gi} className="flex lg:flex-col gap-0.5 shrink-0">
                  {group.label && <div className="hidden lg:block px-3 pb-0.5 text-[11px] text-ink-3">{group.label}</div>}
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      end={item.end}
                      className={({ isActive }) => `rounded-lg px-3 py-1.5 text-sm whitespace-nowrap transition-colors ${isActive ? 'bg-accent/15 text-accent font-medium' : 'text-ink-2 hover:text-ink hover:bg-surface-2'}`}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                  {si === NAV.length - 1 && gi === section.groups.length - 1 && <ThemeToggle />}
                </div>
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
      {/* The Classic Maple pages wear their own parchment theme (index.css .classic-theme). */}
      <div className={classic ? 'classic-theme min-h-screen' : undefined}>
        <main className="px-4 py-5 sm:px-6 lg:px-8 lg:py-7 max-w-[1400px] w-full">
          <Outlet />
        </main>
      </div>
    </div>
  );
}

/** Sits under Settings: flips between the Ember and Aurora color themes (kept per browser). */
function ThemeToggle() {
  const theme = useTheme();
  const name = THEMES.find((t) => t.id === theme)!.name;
  const next = THEMES.find((t) => t.id !== theme)!;
  return (
    <button type="button" onClick={() => setTheme(next.id)} className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm text-ink-2 whitespace-nowrap text-left transition-colors hover:text-ink hover:bg-surface-2 cursor-pointer" aria-label={`Color theme: ${name}. Switch to ${next.name}`} title={`Switch to ${next.name}`}>
      <span className="flex" aria-hidden>
        <span className="size-2.5 rounded-full bg-accent" />
        <span className="-ml-1 size-2.5 rounded-full bg-accent-alt ring-1 ring-surface" />
      </span>
      Theme · {name}
    </button>
  );
}
