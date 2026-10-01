import type { ButtonHTMLAttributes, ReactNode } from 'react';

const PATHS = {
  plus: 'M12 5v14M5 12h14',
  copy: 'M9 9h10v10H9zM5 15V5h10',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  reset: 'M3.5 12a8.5 8.5 0 1 0 2.6-6.1M3.5 4v5h5',
  undo: 'M9 14L4 9l5-5M4 9h10.5a5.5 5.5 0 0 1 0 11H11',
  x: 'M6 6l12 12M18 6L6 18',
  check: 'M8 12.5l2.8 2.8L16.5 9.5M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0z',
  left: 'M15 6l-6 6 6 6',
  right: 'M9 6l6 6-6 6',
  down: 'M6 9l6 6 6-6',
  back: 'M19 12H5M11 6l-6 6 6 6',
} as const;

export function Icon({ name, size = 14, className = '' }: { name: keyof typeof PATHS; size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden className={`shrink-0 ${className}`}>
      <path d={PATHS[name]} />
    </svg>
  );
}

/**
 * A .btn / .btn-accent / .btn-ghost button whose text size and colour apply: the
 * unlayered `button { font: inherit; color: inherit }` in index.css beats classes on
 * the button itself, so they sit on the inner span.
 */
export function Action({ kind = 'btn', small, children, className = '', ...rest }: ButtonHTMLAttributes<HTMLButtonElement> & { kind?: 'btn' | 'accent' | 'ghost'; small?: boolean }) {
  const cls = kind === 'accent' ? 'btn-accent' : kind === 'ghost' ? 'btn-ghost' : 'btn';
  const text = kind === 'accent' ? 'text-black' : kind === 'ghost' ? 'text-ink-2 group-hover:text-ink' : 'text-ink';
  return (
    <button type="button" {...rest} className={`group ${cls} ${small ? 'btn-sm' : ''} ${className}`}>
      <span className={`inline-flex items-center gap-1.5 whitespace-nowrap ${small ? 'text-xs' : 'text-sm'} ${text}`}>{children}</span>
    </button>
  );
}

/** An on/off switch named by its label, which toggles it too. Drawn like the kit's Toggle; a button, so the text classes sit on the inner span. */
export function Switch({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className="inline-flex items-center gap-2 rounded-md cursor-pointer select-none">
      <span aria-hidden className={`relative inline-block h-5 w-9 shrink-0 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-2'}`}>
        <span className={`absolute top-0.5 size-4 rounded-full bg-ink transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      <span className="text-sm text-ink">{label}</span>
    </button>
  );
}

const TONES = { accent: 'border-accent/50 bg-accent/10', warn: 'border-warn/40 bg-warn/10', bad: 'border-bad/40 bg-bad/10' } as const;

/** An inline question with its answers as buttons (instead of confirm()). */
export function Ask({ tone = 'accent', title, children, actions }: { tone?: keyof typeof TONES; title: ReactNode; children?: ReactNode; actions: ReactNode }) {
  return (
    <div role="group" aria-label="Confirm" className={`rounded-lg border px-3 py-2.5 flex flex-wrap items-center gap-x-4 gap-y-2 ${TONES[tone]}`}>
      <div className="min-w-0 flex-[1_1_18rem]">
        <div className="text-sm font-medium text-ink">{title}</div>
        {children && <div className="text-xs text-ink-2 mt-0.5">{children}</div>}
      </div>
      <div className="flex flex-wrap gap-2">{actions}</div>
    </div>
  );
}

export interface ToastMsg {
  text: string;
  sub?: string;
  undo?: () => Promise<void>;
  /** The preset to open after Undo, when the editor is free to move. */
  select?: string;
}

/** Bottom corner notice after a save, delete or reset, with Undo while it shows. */
export function Toast({ msg, onUndo, onClose }: { msg: ToastMsg; onUndo: () => void; onClose: () => void }) {
  return (
    <div role="status" className="fixed z-50 bottom-4 left-4 right-4 sm:left-auto sm:w-[26rem] rounded-xl border border-border-2 bg-surface-2 shadow-2xl shadow-black/50 flex items-start gap-3 px-4 py-3">
      <span className="text-good mt-0.5">
        <Icon name="check" size={16} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-sm font-medium text-ink">{msg.text}</div>
        {msg.sub && <div className="text-xs text-ink-2 mt-0.5">{msg.sub}</div>}
      </div>
      {msg.undo && (
        <Action small onClick={onUndo}>
          <Icon name="undo" size={12} />
          Undo
        </Action>
      )}
      <button type="button" onClick={onClose} aria-label="Dismiss" className="group -mr-1 size-6 grid place-items-center rounded-md hover:bg-surface-3 cursor-pointer">
        <span className="text-ink-3 group-hover:text-ink">
          <Icon name="x" size={14} />
        </span>
      </button>
    </div>
  );
}
