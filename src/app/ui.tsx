import type { ReactNode } from 'react';
import { useEffect } from 'react';

export function Card({ children, className = '', title, action }: { children: ReactNode; className?: string; title?: ReactNode; action?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <header className="flex items-center justify-between gap-3 px-4 pt-3.5 pb-1">
          {title && <h3 className="text-sm font-semibold text-ink">{title}</h3>}
          {action}
        </header>
      )}
      <div className="p-4 pt-2">{children}</div>
    </section>
  );
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: 'accent' | 'good' | 'bad' | 'warn' }) {
  const color = tone === 'accent' ? 'text-accent' : tone === 'good' ? 'text-good' : tone === 'bad' ? 'text-bad' : tone === 'warn' ? 'text-warn' : 'text-ink';
  return (
    <div className="min-w-0">
      <div className="label">{label}</div>
      <div className={`text-xl font-semibold tabular ${color} truncate`}>{value}</div>
      {sub && <div className="text-xs text-ink-3 mt-0.5 truncate">{sub}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3 mb-5">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {subtitle && <p className="text-sm text-ink-2 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <div className="text-ink font-medium">{title}</div>
      {children && <div className="text-sm text-ink-2 mt-2 max-w-lg mx-auto">{children}</div>}
    </div>
  );
}

export function Spinner({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="flex items-center gap-3 text-ink-2 text-sm p-6">
      <span className="inline-block size-4 rounded-full border-2 border-border-2 border-t-accent animate-spin" />
      {label}
    </div>
  );
}

export function Modal({ open, onClose, title, children, wide }: { open: boolean; onClose: () => void; title?: ReactNode; children: ReactNode; wide?: boolean }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className={`card w-full ${wide ? 'max-w-4xl' : 'max-w-xl'} shadow-2xl my-auto`}>
        {title && (
          <header className="flex items-center justify-between px-5 py-3.5 border-b border-border">
            <h2 className="font-semibold">{title}</h2>
            <button className="btn-ghost btn-sm" onClick={onClose} aria-label="Close">
              ✕
            </button>
          </header>
        )}
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
}

export function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label?: ReactNode }) {
  return (
    <label className="inline-flex items-center gap-2 cursor-pointer select-none">
      <span
        role="switch"
        aria-checked={checked}
        tabIndex={0}
        onClick={() => onChange(!checked)}
        onKeyDown={(e) => (e.key === ' ' || e.key === 'Enter') && (e.preventDefault(), onChange(!checked))}
        className={`relative inline-block h-5 w-9 rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border-2'}`}
      >
        <span className={`absolute top-0.5 size-4 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : 'translate-x-0.5'}`} />
      </span>
      {label && <span className="text-sm">{label}</span>}
    </label>
  );
}

export function Stepper({ value, min = 1, max = 6, onChange }: { value: number; min?: number; max?: number; onChange: (v: number) => void }) {
  return (
    <span className="inline-flex items-center rounded-lg border border-border-2 overflow-hidden">
      <button className="px-2 py-0.5 text-sm hover:bg-surface-3 disabled:opacity-30" disabled={value <= min} onClick={() => onChange(value - 1)} aria-label="Decrease">
        −
      </button>
      <span className="px-2 text-sm tabular min-w-6 text-center">{value}</span>
      <button className="px-2 py-0.5 text-sm hover:bg-surface-3 disabled:opacity-30" disabled={value >= max} onClick={() => onChange(value + 1)} aria-label="Increase">
        +
      </button>
    </span>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: ReactNode }) {
  return (
    <label className="block">
      <div className="label mb-1">{label}</div>
      {children}
      {hint && <div className="text-xs text-ink-3 mt-1">{hint}</div>}
    </label>
  );
}

export function Badge({ children, tone = 'muted' }: { children: ReactNode; tone?: 'muted' | 'accent' | 'good' | 'warn' | 'bad' }) {
  const cls =
    tone === 'accent' ? 'border-accent/50 text-accent bg-accent/10' : tone === 'good' ? 'border-good/40 text-good bg-good/10' : tone === 'warn' ? 'border-warn/40 text-warn bg-warn/10' : tone === 'bad' ? 'border-bad/40 text-bad bg-bad/10' : 'border-border-2 text-ink-2';
  return <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

export function Progress({ value, className = '' }: { value: number; className?: string }) {
  return (
    <div className={`h-1.5 w-full rounded-full bg-surface-3 overflow-hidden ${className}`}>
      <div className="h-full rounded-full bg-accent transition-all" style={{ width: `${Math.max(0, Math.min(100, value * 100))}%` }} />
    </div>
  );
}

export function CharacterAvatar({ src, size = 72, alt }: { src: string | null; size?: number; alt: string }) {
  return (
    <div className="shrink-0 rounded-xl bg-surface-2 border border-border flex items-end justify-center overflow-hidden" style={{ width: size, height: size }}>
      {src ? <img src={src} alt={alt} className="max-h-full max-w-full object-contain" style={{ imageRendering: 'pixelated' }} loading="lazy" /> : <span className="text-ink-3 text-xs pb-2">?</span>}
    </div>
  );
}
