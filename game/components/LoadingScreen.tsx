import React from 'react';
import { Html, useProgress } from '@react-three/drei';
import { themeColor } from '../theme';

// In-canvas loading state for a level, in the 2.0 style (dark forest ground, gold progress bar).
export const LoadingScreen: React.FC = () => {
    const { progress } = useProgress();
    const bgColor = themeColor('ground');
    const percent = Math.round(progress);

    return (
        <>
            <color attach="background" args={[bgColor]} />

            <Html
                fullscreen
                style={{
                    position: 'fixed',
                    inset: 0,
                    width: '100vw',
                    height: '100vh',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    pointerEvents: 'none',
                    background: 'var(--tm-ground)',
                }}
            >
                <div className="flex w-[280px] flex-col items-center gap-3 font-body" role="status" aria-live="polite">
                    <span className="tm-eyebrow text-gold">Preparing expedition</span>
                    <span className="h-1.5 w-full bg-line">
                        <span className="block h-1.5 bg-gold transition-[width] duration-200" style={{ width: `${percent}%` }} />
                    </span>
                    <span className="font-display text-2xl font-extrabold text-ink">{percent}%</span>
                </div>
            </Html>
        </>
    );
};

export default LoadingScreen;
