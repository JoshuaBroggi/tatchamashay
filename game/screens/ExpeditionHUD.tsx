import React, { useEffect, useRef, useState } from 'react';
import { Controls } from '../types';
import { Expedition, formatDuration, formatScore } from '../expedition';
import { Eyebrow } from './ui';

export interface HudCrewMember {
  id: string;
  name: string;
  role: string;
}

interface ExpeditionHUDProps {
  expedition: Expedition;
  score: number;
  startedAt: number;
  crew: HudCrewMember[];
  controlsRef: React.MutableRefObject<Controls>;
  onEndExpedition: () => void;
  onLeave: () => void;
}

const PauseIcon: React.FC<{ size: number }> = ({ size }) => (
  <svg width={size} height={size} viewBox="0 0 18 18" aria-hidden="true">
    <path d="M5 3v12M13 3v12" stroke="currentColor" strokeWidth="2.5" fill="none" />
  </svg>
);

// Thumbstick for touch screens: drives the same controls as WASD.
const Thumbstick: React.FC<{ controlsRef: React.MutableRefObject<Controls> }> = ({ controlsRef }) => {
  const baseRef = useRef<HTMLDivElement>(null);
  const pointerId = useRef<number | null>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });

  const release = () => {
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    Object.assign(controlsRef.current, { up: false, down: false, left: false, right: false });
  };

  // Never leave the explorer walking if the overlay unmounts mid-drag.
  useEffect(() => release, []);

  const move = (e: React.PointerEvent) => {
    if (pointerId.current !== e.pointerId || !baseRef.current) return;
    const rect = baseRef.current.getBoundingClientRect();
    const radius = rect.width / 2;
    let dx = e.clientX - (rect.left + radius);
    let dy = e.clientY - (rect.top + radius);
    const dist = Math.hypot(dx, dy);
    if (dist > radius) {
      dx = (dx / dist) * radius;
      dy = (dy / dist) * radius;
    }
    setKnob({ x: dx, y: dy });
    const dead = radius * 0.3;
    Object.assign(controlsRef.current, { up: dy < -dead, down: dy > dead, left: dx < -dead, right: dx > dead });
  };

  return (
    <div
      ref={baseRef}
      className="tm-touch-only tm-stick absolute bottom-6 left-14 h-[120px] w-[120px] touch-none rounded-full"
      aria-label="Move"
      onPointerDown={e => {
        pointerId.current = e.pointerId;
        e.currentTarget.setPointerCapture(e.pointerId);
        move(e);
      }}
      onPointerMove={move}
      onPointerUp={release}
      onPointerCancel={release}
    >
      <span
        className="tm-stick-knob absolute left-1/2 top-1/2 -ml-6 -mt-6 h-12 w-12 rounded-full"
        style={{ transform: `translate(${knob.x}px, ${knob.y}px)` }}
      />
    </div>
  );
};

// Screen 5 · In-game overlay (docs/design/2.0/screens/HUD.dc.html, MobileHUD.dc.html)
export const ExpeditionHUD: React.FC<ExpeditionHUDProps> = ({
  expedition,
  score,
  startedAt,
  crew,
  controlsRef,
  onEndExpedition,
  onLeave,
}) => {
  const [now, setNow] = useState(() => Date.now());
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Escape') setMenuOpen(open => !open);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const setAttack = (on: boolean) => {
    controlsRef.current.attack = on;
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-10 select-none font-body text-ink">
      {/* Objective */}
      <div className="absolute left-6 top-6 flex w-[260px] flex-col gap-2.5 bg-panel px-[18px] py-4 short:left-14 short:top-4 short:w-[190px] short:gap-1 short:px-3 short:py-2.5">
        <Eyebrow className="text-gold short:hidden">{expedition.name}</Eyebrow>
        <span className="text-[15px] short:text-xs">{expedition.objective}</span>
        <span className="text-xs text-ink-soft">Time {formatDuration(now - startedAt)}</span>
      </div>

      {/* Treasure + pause */}
      <div className="absolute right-6 top-6 flex items-start gap-3 short:right-14 short:top-4 short:gap-2">
        <div className="flex flex-col items-end bg-panel px-[18px] py-3 short:px-3 short:py-2">
          <Eyebrow className="text-ink-soft short:hidden">Treasure</Eyebrow>
          <span className="font-display text-4xl font-extrabold leading-tight text-gold short:text-2xl" aria-label={`Treasure ${score}`}>
            {formatScore(score)}
          </span>
        </div>
        <button
          type="button"
          aria-label="Pause menu"
          onClick={() => setMenuOpen(true)}
          className="pointer-events-auto flex h-[52px] w-[52px] cursor-pointer items-center justify-center border border-line-strong bg-panel text-ink hover:bg-ground-raised short:h-11 short:w-11"
        >
          <PauseIcon size={18} />
        </button>
      </div>

      {/* Crew */}
      {crew.length > 0 && (
        <div className="absolute bottom-6 left-6 flex flex-col gap-2 bg-panel px-4 py-3 short:hidden">
          <Eyebrow className="text-ink-soft">Crew</Eyebrow>
          {crew.map(m => (
            <span key={m.id} className="text-sm">
              <span className="text-ok">●</span> {m.name} · {m.role}
            </span>
          ))}
        </div>
      )}

      {/* Key hints (keyboard) */}
      <div className="tm-pointer-only absolute bottom-6 left-1/2 flex -translate-x-1/2 gap-2">
        {[
          ['WASD', 'Move'],
          ['Space', 'Strike'],
          ['Drag', 'Look'],
          ['Esc', 'Menu'],
        ].map(([key, label], i) => (
          <div
            key={key}
            className={`box-border flex h-[72px] w-[84px] flex-col justify-between bg-panel p-2 ${i === 1 ? 'border-2 border-gold' : 'border border-line'}`}
          >
            <span className="text-[11px] text-ink-muted">{key}</span>
            <span className="text-xs font-semibold">{label}</span>
          </div>
        ))}
      </div>

      {/* Touch controls (phone) */}
      <div className="pointer-events-auto">
        <Thumbstick controlsRef={controlsRef} />
      </div>
      <button
        type="button"
        className="tm-touch-only pointer-events-auto absolute bottom-6 right-14 h-20 w-20 touch-none rounded-full border-0 bg-gold font-body text-[13px] font-semibold text-ground"
        onPointerDown={() => setAttack(true)}
        onPointerUp={() => setAttack(false)}
        onPointerCancel={() => setAttack(false)}
        onPointerLeave={() => setAttack(false)}
      >
        Strike
      </button>

      {/* Pause menu */}
      {menuOpen && (
        <div className="pointer-events-auto absolute inset-0 z-20 flex items-center justify-center bg-panel" role="dialog" aria-modal="true" aria-label="Paused">
          <div className="flex w-[320px] flex-col gap-3 border border-line-strong bg-ground p-7 short:gap-2 short:p-4">
            <Eyebrow className="text-gold">{expedition.name}</Eyebrow>
            <h2 className="tm-display m-0 text-[44px] leading-none text-ink short:text-3xl">Paused</h2>
            <button type="button" className="tm-btn tm-btn-primary h-[54px] w-full text-[22px] short:h-11" onClick={() => setMenuOpen(false)} autoFocus>
              Keep exploring
            </button>
            <button type="button" className="tm-btn tm-btn-quiet h-[54px] w-full text-[22px] short:h-11" onClick={onEndExpedition}>
              End expedition
            </button>
            <button type="button" className="tm-link self-center" onClick={onLeave}>
              Leave to title
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ExpeditionHUD;
