import React from 'react';
import { Html, useProgress } from '@react-three/drei';

// Tips shown during loading
const OVERWORLD_TIPS = [
    "Tip: Pop balloons with SPACE to score points!",
    "Tip: Climb the poop pile for a surprise!",
    "Tip: Use WASD to move around!",
    "Tip: Look for colorful balloons to pop!",
];

export const LoadingScreen: React.FC = () => {
    const { progress } = useProgress();

    const randomTip = OVERWORLD_TIPS[Math.floor(Math.random() * OVERWORLD_TIPS.length)];

    const bgColor = '#87CEEB';
    const textColor = '#3b82f6';
    const progressBarBg = '#bfdbfe';
    const progressBarFill = 'linear-gradient(90deg, #3b82f6, #60a5fa)';

    const levelName = 'Overworld';
    const levelDesc = 'Loading the sunny world...';
    
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
                        backgroundColor: 'rgba(255, 255, 255, 0.95)',
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
                        🌅
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
                            color: '#64748b',
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
                            color: '#1e40af',
                            margin: '0 0 24px 0',
                        }}
                    >
                        {Math.round(progress)}%
                    </p>
                    
                    {/* Tip */}
                    <p 
                        style={{
                            fontSize: '14px',
                            color: '#6b7280',
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
