import React from 'react';

// Shared pieces of the 2.0 menu screens (docs/design/2.0/screens).

/** Full-height menu page: 40/56px padding at desktop, tighter on a landscape phone. */
export const MenuScreen: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = '' }) => (
  <div className="tm-screen">
    <div
      className={`min-h-full box-border flex flex-col gap-7 px-14 py-10 short:gap-3 short:px-6 short:py-3 ${className}`}
    >
      {children}
    </div>
  </div>
);

/** Header row: back link · title · right-hand status. */
export const ScreenHeader: React.FC<{
  backLabel: string;
  onBack: () => void;
  title: string;
  right?: React.ReactNode;
}> = ({ backLabel, onBack, title, right }) => (
  <header className="flex flex-none items-baseline justify-between gap-4 border-b border-line pb-[18px] short:pb-2">
    <button type="button" onClick={onBack} className="tm-link flex-none short:text-[13px]">
      ← {backLabel}
    </button>
    <h1 className="tm-display m-0 text-center text-[44px] leading-none tracking-[3px] text-ink short:text-[26px]">
      {title}
    </h1>
    <span className="flex-none text-right text-sm font-semibold tracking-[2px] text-gold short:text-xs">{right}</span>
  </header>
);

export const Eyebrow: React.FC<{ children: React.ReactNode; className?: string }> = ({ children, className = 'text-gold' }) => (
  <span className={`tm-eyebrow ${className}`}>{children}</span>
);
