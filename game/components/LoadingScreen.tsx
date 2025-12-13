import React from 'react';
import { Html, useProgress } from '@react-three/drei';
import { Level } from '../types';

interface LoadingScreenProps {
    targetLevel: Level;
}

// Tips shown during loading
const CAVE_TIPS = [
    "Tip: Walk into gems to collect them!",
    "Tip: Press SPACE to kick potatoes at gems!",
    "Tip: Explore the central chamber for treasures!",
    "Tip: Look for the return door to go back!",
];

const OVERWORLD_TIPS = [
    "Tip: Pop balloons with SPACE to score points!",
    "Tip: Climb the poop pile for a surprise!",
    "Tip: Look for the magical door near the poop pile!",
    "Tip: Use WASD to move around!",
];

export const LoadingScreen: React.FC<LoadingScreenProps> = ({ targetLevel }) => {
    const { progress } = useProgress();
    
    const isCave = targetLevel === 'cave';
    const tips = isCave ? CAVE_TIPS : OVERWORLD_TIPS;
    const randomTip = tips[Math.floor(Math.random() * tips.length)];
    
    const bgColor = isCave ? '#1a1a2e' : '#87CEEB';
    const textColor = isCave ? '#a78bfa' : '#3b82f6';
    const progressBarBg = isCave ? '#4c1d95' : '#bfdbfe';
    const progressBarFill = isCave 
        ? 'linear-gradient(90deg, #8b5cf6, #a78bfa)' 
        : 'linear-gradient(90deg, #3b82f6, #60a5fa)';
    
    const levelName = isCave ? 'The Cave' : 'Overworld';
    const levelDesc = isCave 
        ? 'Entering the mysterious cave...' 
        : 'Returning to the surface...';
    
    return (
        <>
            {/* Set scene background to match loading screen */}
            <color attach="background" args={[bgColor]} />
            <ambientLight intensity={0.3} />
            
            <Html center>
                <div 
                    style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        padding: '48px',
                        backgroundColor: isCave ? 'rgba(30, 27, 75, 0.95)' : 'rgba(255, 255, 255, 0.95)',
                        borderRadius: '24px',
                        boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
                        border: `4px solid ${textColor}`,
                        minWidth: '400px',
                        fontFamily: 'system-ui, -apple-system, sans-serif',
                    }}
                >
                    {/* Level Icon */}
                    <div 
                        style={{
                            fontSize: '64px',
                            marginBottom: '16px',
                        }}
                    >
                        {isCave ? '🦇' : '🌅'}
                    </div>
                    
                    {/* Level Name */}
                    <h2 
                        style={{
                            fontSize: '32px',
                            fontWeight: 'bold',
                            color: textColor,
                            margin: '0 0 8px 0',
                            letterSpacing: '2px',
                        }}
                    >
                        {levelName}
                    </h2>
                    
                    {/* Loading Description */}
                    <p 
                        style={{
                            fontSize: '18px',
                            color: isCave ? '#c4b5fd' : '#64748b',
                            margin: '0 0 32px 0',
                        }}
                    >
                        {levelDesc}
                    </p>
                    
                    {/* Progress Bar Container */}
                    <div 
                        style={{
                            width: '320px',
                            height: '24px',
                            backgroundColor: progressBarBg,
                            borderRadius: '12px',
                            overflow: 'hidden',
                            marginBottom: '12px',
                        }}
                    >
                        {/* Progress Bar Fill */}
                        <div 
                            style={{
                                width: `${progress}%`,
                                height: '100%',
                                background: progressBarFill,
                                borderRadius: '12px',
                                transition: 'width 0.3s ease-out',
                            }}
                        />
                    </div>
                    
                    {/* Progress Percentage */}
                    <p 
                        style={{
                            fontSize: '20px',
                            fontWeight: 'bold',
                            color: isCave ? '#e9d5ff' : '#1e40af',
                            margin: '0 0 24px 0',
                        }}
                    >
                        {Math.round(progress)}%
                    </p>
                    
                    {/* Tip */}
                    <p 
                        style={{
                            fontSize: '14px',
                            color: isCave ? '#a78bfa' : '#6b7280',
                            margin: 0,
                            fontStyle: 'italic',
                            maxWidth: '300px',
                            textAlign: 'center',
                        }}
                    >
                        {randomTip}
                    </p>
                </div>
            </Html>
        </>
    );
};

export default LoadingScreen;
