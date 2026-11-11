import React, { useEffect } from 'react';
import { Level } from '../types';
import { EXPEDITIONS, dangerMeter } from '../expedition';
import { MenuScreen, ScreenHeader, Eyebrow } from './ui';

interface ExpeditionSelectProps {
  level: Level;
  onPick: (level: Level) => void;
  onBack: () => void;
  onInviteCrew: () => void;
  onEmbark: () => void;
}

// Screen 3 · Choose expedition (docs/design/2.0/screens/LevelSelect.dc.html)
export const ExpeditionSelect: React.FC<ExpeditionSelectProps> = ({ level, onPick, onBack, onInviteCrew, onEmbark }) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const index = EXPEDITIONS.findIndex(x => x.level === level);
      const step = e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0;
      if (step !== 0) {
        e.preventDefault();
        onPick(EXPEDITIONS[(index + step + EXPEDITIONS.length) % EXPEDITIONS.length].level);
      } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onEmbark();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [level, onPick, onEmbark]);

  return (
    <MenuScreen>
      <ScreenHeader backLabel="Back" onBack={onBack} title="Choose an expedition" right="Step 2 / 2" />

      <div className="grid flex-grow grid-cols-3 gap-5 short:gap-3" role="radiogroup" aria-label="Expedition">
        {EXPEDITIONS.map(x => {
          const isPicked = x.level === level;
          return (
            <button
              key={x.level}
              type="button"
              role="radio"
              aria-checked={isPicked}
              onClick={() => onPick(x.level)}
              onDoubleClick={onEmbark}
              className={`flex cursor-pointer flex-col overflow-hidden border-2 bg-ground-raised p-0 text-left font-body transition-colors ${
                isPicked ? 'border-gold' : 'border-line hover:border-line-strong'
              }`}
            >
              <span className="block min-h-[90px] w-full flex-grow short:min-h-[36px]" style={{ background: x.sceneGradient }} aria-hidden="true" />
              <span className="flex w-full flex-col gap-2 bg-ground-raised p-5 short:gap-1 short:p-3">
                <Eyebrow className="text-gold short:text-[10px]">{x.region}</Eyebrow>
                <span className="font-display text-[32px] font-extrabold leading-none text-ink short:text-xl">{x.name}</span>
                <span className="min-h-[66px] text-[15px] leading-[1.45] text-ink-soft short:line-clamp-2 short:min-h-0 short:text-xs">{x.description}</span>
                <span className="flex gap-4 text-[13px] font-semibold text-ink-body short:text-[11px]">
                  <span>{x.relics} relics</span>
                  <span>
                    Danger <span aria-label={`${x.danger} of 3`}>{dangerMeter(x.danger)}</span>
                  </span>
                </span>
              </span>
            </button>
          );
        })}
      </div>

      <footer className="flex flex-none justify-end gap-4 short:gap-3">
        <button type="button" className="tm-btn tm-btn-secondary w-[220px] text-2xl short:h-11 short:w-44 short:text-xl" onClick={onInviteCrew}>
          Invite crew
        </button>
        <button type="button" className="tm-btn tm-btn-primary w-[220px] short:h-11 short:w-44 short:text-xl" onClick={onEmbark}>
          Embark
        </button>
      </footer>
    </MenuScreen>
  );
};

export default ExpeditionSelect;
