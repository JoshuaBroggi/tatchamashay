import React, { useState, useRef, useEffect, Suspense } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sword, Play, RotateCcw } from 'lucide-react';
import { Canvas, ThreeElements } from '@react-three/fiber';
import Game3D from './game/Game3D';
import { Controls } from './game/types';

// Augment React's JSX namespace to include Three.js elements
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'menu' | 'playing'>('menu');
  const [score, setScore] = useState(0);
  
  // Control state ref to pass to the 3D loop without re-renders
  const controlsRef = useRef<Controls>({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
  });

  useEffect(() => {
    console.log("App Mounted");
  }, []);

  // Keyboard listeners
  useEffect(() => {
    const handleKeyDown = (e: any) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': controlsRef.current.up = true; break;
        case 'KeyS': case 'ArrowDown': controlsRef.current.down = true; break;
        case 'KeyA': case 'ArrowLeft': controlsRef.current.left = true; break;
        case 'KeyD': case 'ArrowRight': controlsRef.current.right = true; break;
        case 'Space': controlsRef.current.attack = true; break;
      }
    };

    const handleKeyUp = (e: any) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': controlsRef.current.up = false; break;
        case 'KeyS': case 'ArrowDown': controlsRef.current.down = false; break;
        case 'KeyA': case 'ArrowLeft': controlsRef.current.left = false; break;
        case 'KeyD': case 'ArrowRight': controlsRef.current.right = false; break;
        case 'Space': controlsRef.current.attack = false; break;
      }
    };

    (window as any).addEventListener('keydown', handleKeyDown);
    (window as any).addEventListener('keyup', handleKeyUp);
    return () => {
      (window as any).removeEventListener('keydown', handleKeyDown);
      (window as any).removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  const updateControl = (key: keyof Controls, value: boolean) => {
    controlsRef.current[key] = value;
  };

  const startGame = () => {
    setScore(0);
    setGameState('playing');
  };

  return (
    <div className="relative w-full h-full bg-[#87CEEB] overflow-hidden select-none font-sans">
      
      {/* 3D Scene */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 50 }}
        dpr={[1, 2]} // Handle high-dpi screens
        className="absolute inset-0 z-0"
        onError={(e) => console.error("Canvas Error:", e)}
      >
        <Suspense fallback={null}>
          <color attach="background" args={['#87CEEB']} />
          <fog attach="fog" args={['#87CEEB', 40, 150]} />
          <Game3D 
            isPlaying={gameState === 'playing'} 
            controlsRef={controlsRef} 
            onScoreUpdate={setScore}
          />
        </Suspense>
      </Canvas>

      {/* --- UI LAYER --- */}

      {/* Main Menu Overlay */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="bg-white/90 p-8 rounded-3xl shadow-2xl text-center border-4 border-yellow-400 max-w-md w-full mx-4 transform transition-all hover:scale-105">
            <h1 className="text-5xl md:text-6xl font-black text-blue-600 mb-2 drop-shadow-md tracking-wider">
              TATCHAMASHAY
            </h1>
            <h2 className="text-3xl md:text-4xl font-bold text-orange-500 mb-8 tracking-wide">
              BALLOON POP 3D
            </h2>
            
            <button 
              onClick={startGame}
              className="bg-green-500 hover:bg-green-600 text-white text-3xl font-bold py-4 px-12 rounded-full shadow-lg transform transition active:scale-95 flex items-center justify-center gap-3 mx-auto border-b-8 border-green-700 active:border-b-0 active:translate-y-2"
            >
              <Play fill="currentColor" size={32} /> PLAY
            </button>

            <p className="mt-8 text-gray-500 text-lg font-medium">
              Use WASD or Joystick to Move<br/>SPACE to Pop!
            </p>
          </div>
        </div>
      )}

      {/* HUD (Heads Up Display) */}
      {gameState === 'playing' && (
        <>
          {/* Score & Menu Button */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-3 px-6 shadow-xl border-4 border-yellow-400 transform transition-transform key-score-pulse">
              <span className="text-yellow-600 font-bold text-xl uppercase tracking-wider block text-xs">Score</span>
              <span className="text-4xl font-black text-gray-800">{score}</span>
            </div>

            <button 
              onClick={() => setGameState('menu')}
              className="pointer-events-auto bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
            >
              <RotateCcw size={24} />
            </button>
          </div>

          {/* Touch Controls (Mobile) */}
          <div className="absolute inset-0 pointer-events-none z-20 flex flex-col justify-end pb-8 px-6 sm:hidden">
            <div className="flex justify-between items-end w-full">
              
              {/* D-Pad */}
              <div className="pointer-events-auto bg-white/20 backdrop-blur-md rounded-full p-4 grid grid-cols-3 gap-2 shadow-xl border border-white/30">
                 <div />
                 <button 
                   onTouchStart={(e) => { e.preventDefault(); updateControl('up', true)}} 
                   onTouchEnd={(e) => { e.preventDefault(); updateControl('up', false)}}
                   className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white active:bg-blue-600 shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1">
                   <ArrowUp size={28} />
                 </button>
                 <div />
                 
                 <button 
                   onTouchStart={(e) => { e.preventDefault(); updateControl('left', true)}} 
                   onTouchEnd={(e) => { e.preventDefault(); updateControl('left', false)}}
                   className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white active:bg-blue-600 shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1">
                   <ArrowLeft size={28} />
                 </button>
                 <div className="w-14 h-14 bg-white/10 rounded-full" />
                 <button 
                   onTouchStart={(e) => { e.preventDefault(); updateControl('right', true)}} 
                   onTouchEnd={(e) => { e.preventDefault(); updateControl('right', false)}}
                   className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white active:bg-blue-600 shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1">
                   <ArrowRight size={28} />
                 </button>

                 <div />
                 <button 
                   onTouchStart={(e) => { e.preventDefault(); updateControl('down', true)}} 
                   onTouchEnd={(e) => { e.preventDefault(); updateControl('down', false)}}
                   className="w-14 h-14 bg-blue-500 rounded-full flex items-center justify-center text-white active:bg-blue-600 shadow-lg border-b-4 border-blue-700 active:border-b-0 active:translate-y-1">
                   <ArrowDown size={28} />
                 </button>
                 <div />
              </div>

              {/* Attack Button */}
              <button 
                 onTouchStart={(e) => { e.preventDefault(); updateControl('attack', true)}} 
                 onTouchEnd={(e) => { e.preventDefault(); updateControl('attack', false)}}
                 className="pointer-events-auto w-24 h-24 bg-red-500 rounded-full flex items-center justify-center text-white active:bg-red-600 shadow-xl border-4 border-white/40 animate-pulse active:scale-95">
                 <Sword size={40} />
              </button>
            </div>
          </div>

          {/* Desktop Helper */}
          <div className="hidden sm:block absolute bottom-6 left-6 bg-white/20 backdrop-blur text-white p-4 rounded-xl border border-white/30 pointer-events-none">
            <p className="font-bold text-lg mb-1">Controls</p>
            <div className="flex items-center gap-2 text-sm"><span className="bg-white/20 px-2 py-1 rounded">WASD</span> Move</div>
            <div className="flex items-center gap-2 text-sm mt-1"><span className="bg-white/20 px-2 py-1 rounded">SPACE</span> Pop Balloon</div>
          </div>
        </>
      )}
    </div>
  );
};

export default App;