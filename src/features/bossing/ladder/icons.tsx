import type { ReactNode } from 'react';

/** 16px stroke icons drawn in currentColor; size and colour come from className. */
function Icon({ className = 'size-3', label, width = 1.75, children }: { className?: string; label?: string; width?: number; children: ReactNode }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth={width} strokeLinecap="round" strokeLinejoin="round" role={label ? 'img' : undefined} aria-label={label} aria-hidden={label ? undefined : true}>
      {children}
    </svg>
  );
}

type P = { className?: string };

export const ChevronLeft = ({ className }: P) => (
  <Icon className={className} width={1.8}>
    <path d="M10 3.5L5.5 8l4.5 4.5" />
  </Icon>
);
export const ChevronRight = ({ className }: P) => (
  <Icon className={className} width={1.8}>
    <path d="M6 3.5L10.5 8 6 12.5" />
  </Icon>
);
export const ChevronDown = ({ className }: P) => (
  <Icon className={className}>
    <path d="M3.5 6L8 10.5 12.5 6" />
  </Icon>
);
export const Check = ({ className }: P) => (
  <Icon className={className} width={2}>
    <path d="M3.5 8.5l3 3 6-7" />
  </Icon>
);
export const Close = ({ className }: P) => (
  <Icon className={className}>
    <path d="M4 4l8 8M12 4l-8 8" />
  </Icon>
);
export const Plus = ({ className }: P) => (
  <Icon className={className} width={1.8}>
    <path d="M8 3v10M3 8h10" />
  </Icon>
);
export const UndoIcon = ({ className }: P) => (
  <Icon className={className}>
    <path d="M5.5 3.5L2.5 6.5l3 3" />
    <path d="M2.5 6.5h7a3.5 3.5 0 0 1 0 7h-2" />
  </Icon>
);
export const People = ({ className }: P) => (
  <Icon className={className} width={1.5}>
    <circle cx="6" cy="5.5" r="2.25" />
    <path d="M2 13.25c0-2.2 1.8-3.6 4-3.6s4 1.4 4 3.6" />
    <path d="M10.6 3.4a2.25 2.25 0 0 1 0 4.3M12.2 9.9c1.1.5 1.8 1.6 1.8 3.3" />
  </Icon>
);
export const Info = ({ className }: P) => (
  <Icon className={className} width={1.6}>
    <circle cx="8" cy="8" r="6.25" />
    <path d="M8 4.75v3.75M8 11.1v.15" />
  </Icon>
);
export const Pencil = ({ className }: P) => (
  <Icon className={className} width={1.5}>
    <path d="M10.6 3.2l2.2 2.2-7.1 7.1-2.9.7.7-2.9z" />
  </Icon>
);
export const Grip = ({ className }: P) => (
  <Icon className={className} width={2.2}>
    <path d="M6 4h.01M10 4h.01M6 8h.01M10 8h.01M6 12h.01M10 12h.01" />
  </Icon>
);
export const SelectIcon = ({ className }: P) => (
  <Icon className={className} width={1.6}>
    <rect x="2.5" y="2.5" width="11" height="11" rx="2.5" />
    <path d="M5.4 8.1l1.9 1.9 3.3-3.7" />
  </Icon>
);
export const ArrowRight = ({ className }: P) => (
  <Icon className={className} width={1.6}>
    <path d="M2.5 8h11M10.5 5l3 3-3 3" />
  </Icon>
);
/** The main character's star, filled in the accent. */
export const Star = ({ className = 'size-3' }: P) => (
  <Icon className={className} label="Main" width={1.5}>
    <path d="M8 1.9l1.85 3.8 4.15.6-3 2.95.7 4.15L8 11.45 4.3 13.4l.7-4.15-3-2.95 4.15-.6z" fill="currentColor" />
  </Icon>
);
