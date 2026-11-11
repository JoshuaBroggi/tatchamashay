import React from 'react';
import { Level } from '../types';
import { formatDuration, formatScore, getExpedition } from '../expedition';
import { MenuScreen, Eyebrow } from './ui';

export interface ExpeditionRun {
  level: Level;
  score: number;
  durationMs: number;
  crew: { id: string; name: string; role: string; isYou: boolean; isLeader: boolean }[];
}

interface ResultsScreenProps {
  run: ExpeditionRun;
  onBaseCamp: () => void;
  onNextExpedition: () => void;
}

// Screen 7 · Results (docs/design/2.0/screens/Results.dc.html)
// 1.x only tracks the local player's score, so other crew members show no score yet.
export const ResultsScreen: React.FC<ResultsScreenProps> = ({ run, onBaseCamp, onNextExpedition }) => {
  const expedition = getExpedition(run.level);
  const tiles = [
    { label: 'Treasure', value: formatScore(run.score) },
    { label: 'Time', value: formatDuration(run.durationMs) },
    { label: 'Crew', value: `${run.crew.length} / 4` },
  ];

  return (
    <MenuScreen>
      <header className="flex flex-none flex-col gap-1.5 border-b border-line pb-[18px] short:gap-0.5 short:pb-2">
        <span className="text-[13px] font-semibold tracking-[4px] text-ok short:text-[11px]">
          EXPEDITION COMPLETE · {formatDuration(run.durationMs)}
        </span>
        <h1 className="tm-display m-0 text-[56px] leading-none tracking-[2px] text-ink short:text-[30px]">{expedition.name}</h1>
      </header>

      <div className="flex flex-grow gap-9 short:gap-4">
        <div className="flex w-[420px] flex-none flex-col gap-3.5 short:w-[42%] short:gap-2">
          <Eyebrow className="text-ink-soft">Expedition log</Eyebrow>
          <div className="grid grid-cols-3 gap-2.5 short:gap-2">
            {tiles.map(t => (
              <div
                key={t.label}
                className="box-border flex h-[92px] flex-col justify-end gap-1 border border-line-strong bg-gradient-to-b from-line to-ground-raised p-2.5 short:h-14 short:p-2"
              >
                <span className="text-xs font-semibold text-ink-soft">{t.label}</span>
                <span className="font-display text-2xl font-extrabold leading-none text-ink short:text-lg">{t.value}</span>
              </div>
            ))}
          </div>
          <div className="mt-auto flex items-baseline justify-between border border-gold px-5 py-[18px] short:px-3 short:py-2">
            <Eyebrow className="text-[13px] text-ink-soft">Your treasure</Eyebrow>
            <span className="font-display text-[44px] font-extrabold leading-none text-gold short:text-[28px]">{formatScore(run.score)}</span>
          </div>
        </div>

        <div className="flex flex-grow flex-col gap-2.5 short:gap-1.5">
          <Eyebrow className="text-ink-soft">Crew</Eyebrow>
          {run.crew.map(m => (
            <div key={m.id} className="flex items-center gap-5 border border-line bg-ground-raised px-5 py-4 short:gap-3 short:px-3 short:py-2">
              <span className="flex min-w-0 flex-grow flex-col gap-0.5">
                <span className="truncate font-display text-[26px] font-extrabold leading-none text-ink short:text-lg">
                  {m.isYou ? 'You' : m.name}
                </span>
                <span className="text-[13px] text-ink-soft short:text-[11px]">{m.role}</span>
              </span>
              {m.isLeader && <span className="text-[13px] font-semibold tracking-[1px] text-gold short:text-[11px]">LEADER</span>}
              <span className="w-[90px] text-right font-display text-[28px] font-extrabold short:w-14 short:text-xl">
                {m.isYou ? formatScore(run.score) : '—'}
              </span>
            </div>
          ))}
        </div>
      </div>

      <footer className="flex flex-none justify-end gap-3.5">
        <button type="button" className="tm-btn tm-btn-quiet h-[58px] w-[200px] text-[22px] short:h-11 short:w-40 short:text-lg" onClick={onBaseCamp}>
          Base camp
        </button>
        <button type="button" className="tm-btn tm-btn-primary h-[58px] w-[240px] text-2xl short:h-11 short:w-48 short:text-xl" onClick={onNextExpedition}>
          Next expedition
        </button>
      </footer>
    </MenuScreen>
  );
};

export default ResultsScreen;
