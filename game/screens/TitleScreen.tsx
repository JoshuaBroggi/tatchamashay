import React from 'react';
import { useNavigate } from 'react-router-dom';

// Screen 1 · Title (docs/design/2.0/screens/Main.dc.html)
export const TitleScreen: React.FC = () => {
  const navigate = useNavigate();

  return (
    <div className="tm-screen tm-title-scene">
      <div className="flex min-h-full max-w-[600px] flex-col justify-center gap-6 py-10 pl-24 pr-6 short:gap-3 short:py-4 short:pl-12">
        <span className="text-[15px] font-semibold tracking-[4px] text-gold short:text-xs">2.0 · EXPEDITIONS</span>
        <h1 className="tm-display m-0 text-[120px] leading-[0.9] tracking-[1px] text-ink short:text-[64px]">
          Tatcha&#8203;mashay
        </h1>
        <p className="m-0 max-w-[480px] text-xl leading-normal text-ink-soft short:text-[15px]">
          Find lost relics in ruins, deserts and jungles. Go alone, or bring a crew of up to four.
        </p>
        <div className="mt-4 flex flex-wrap gap-4 short:mt-1 short:gap-3">
          <button type="button" className="tm-btn tm-btn-primary w-60 short:h-12 short:w-48 short:text-[22px]" onClick={() => navigate('/character-select')}>
            Start solo
          </button>
          <button type="button" className="tm-btn tm-btn-secondary w-60 short:h-12 short:w-48 short:text-[22px]" onClick={() => navigate('/lobby')}>
            Join a crew
          </button>
        </div>
        <nav className="flex gap-7 text-[15px] font-semibold short:text-[13px]">
          <button type="button" className="tm-link text-ink-body" onClick={() => navigate('/build')}>
            Field guide
          </button>
          <button type="button" className="tm-link text-ink-body" onClick={() => navigate('/about')}>
            About the project
          </button>
        </nav>
      </div>
    </div>
  );
};

export default TitleScreen;
