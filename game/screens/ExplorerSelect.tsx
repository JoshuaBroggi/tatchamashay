import React, { Suspense, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { CharacterSelectScene } from '../components/CharacterSelect';
import { EXPLORER_ROLES, ExplorerRoleId, getExplorerRole } from '../expedition';
import { MenuScreen, ScreenHeader, Eyebrow } from './ui';

interface ExplorerSelectProps {
  explorerId: ExplorerRoleId;
  onPick: (id: ExplorerRoleId) => void;
  onBack: () => void;
  backLabel: string;
  onContinue: () => void;
  continueLabel: string;
  stepLabel?: string;
}

// Screen 2 · Choose explorer (docs/design/2.0/screens/CharacterSelect.dc.html)
export const ExplorerSelect: React.FC<ExplorerSelectProps> = ({
  explorerId,
  onPick,
  onBack,
  backLabel,
  onContinue,
  continueLabel,
  stepLabel,
}) => {
  const selected = getExplorerRole(explorerId);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const index = EXPLORER_ROLES.findIndex(r => r.id === explorerId);
      const step = e.code === 'ArrowRight' ? 1 : e.code === 'ArrowLeft' ? -1 : 0;
      if (step !== 0) {
        e.preventDefault();
        onPick(EXPLORER_ROLES[(index + step + EXPLORER_ROLES.length) % EXPLORER_ROLES.length].id);
      } else if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        onContinue();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [explorerId, onPick, onContinue]);

  const stats = [
    { label: 'Speed', value: selected.stats.speed },
    { label: 'Climb', value: selected.stats.climb },
    { label: 'Insight', value: selected.stats.insight },
  ];

  return (
    <MenuScreen>
      <ScreenHeader backLabel={backLabel} onBack={onBack} title="Choose your explorer" right={stepLabel} />

      <div className="flex min-h-0 flex-grow gap-9 short:gap-5">
        {/* Turntable + selected explorer */}
        <div className="flex w-[470px] flex-none flex-col gap-[18px] short:w-[38%] short:gap-2">
          <div
            className="tm-turntable relative min-h-[240px] flex-grow overflow-hidden border border-line short:min-h-[150px]"
            aria-label={`${selected.role} turntable`}
          >
            <Canvas camera={{ position: [0, 2, 6], fov: 50 }} className="!absolute inset-0" dpr={[1, 2]}>
              <Suspense fallback={null}>
                <CharacterSelectScene selectedCharacter={selected.characterVariant} onSelectCharacter={() => {}} tone="expedition" />
              </Suspense>
            </Canvas>
          </div>
          <div className="flex flex-col gap-1.5 short:gap-0.5">
            <Eyebrow className="text-[13px] text-gold short:text-[11px]">{selected.role}</Eyebrow>
            <h2 className="m-0 font-display text-[44px] font-extrabold leading-none text-ink short:text-[26px]">{selected.name}</h2>
            <p className="m-0 text-base text-ink-soft short:text-[13px]">{selected.perk}</p>
          </div>
        </div>

        {/* Roles + stats */}
        <div className="flex flex-grow flex-col gap-6 short:gap-3">
          <div className="grid grid-cols-3 gap-3.5 short:gap-2" role="radiogroup" aria-label="Explorer role">
            {EXPLORER_ROLES.map(role => {
              const isPicked = role.id === explorerId;
              return (
                <button
                  key={role.id}
                  type="button"
                  role="radio"
                  aria-checked={isPicked}
                  onClick={() => onPick(role.id)}
                  className={`flex h-[92px] cursor-pointer flex-col items-start justify-center gap-1 border-2 bg-ground-raised px-4 py-3.5 text-left font-body transition-colors short:h-[58px] short:px-3 short:py-1.5 ${
                    isPicked ? 'border-gold' : 'border-line hover:border-line-strong'
                  }`}
                >
                  <Eyebrow className="text-gold tracking-[2px] short:text-[10px]">{role.role}</Eyebrow>
                  <span className="font-display text-[26px] font-extrabold leading-none text-ink short:text-[18px]">{role.name}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3.5 short:gap-2">
            {stats.map(s => (
              <div key={s.label} className="flex items-center gap-4">
                <span className="tm-eyebrow w-[110px] text-[13px] tracking-[2px] text-ink-soft short:w-20 short:text-[11px]">{s.label}</span>
                <span className="h-2 flex-grow bg-ground-high" role="meter" aria-label={s.label} aria-valuenow={s.value} aria-valuemin={0} aria-valuemax={100}>
                  <span className="block h-2 bg-gold transition-[width] duration-300" style={{ width: `${s.value}%` }} />
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <footer className="flex flex-none justify-end">
        <button type="button" className="tm-btn tm-btn-primary min-w-[280px] short:h-11 short:min-w-0 short:text-xl" onClick={onContinue}>
          {continueLabel}
        </button>
      </footer>
    </MenuScreen>
  );
};

export default ExplorerSelect;
