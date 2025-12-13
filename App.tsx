import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sword, Play, RotateCcw, Gem, ChevronLeft, ChevronRight } from 'lucide-react';
import { Canvas, ThreeElements } from '@react-three/fiber';
import { Html, useProgress } from '@react-three/drei';
import Game3D from './game/Game3D';
import { Controls, Level, CharacterVariant, CHARACTER_CONFIGS } from './game/types';
import { CharacterSelectScene } from './game/components/CharacterSelect';

// Augment React's JSX namespace to include Three.js elements
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

// Loading fallback shown while 3D assets load (inside Canvas)
const LoadingFallback = () => {
  const { progress, errors } = useProgress();
  
  return (
    <>
      <color attach="background" args={['#87CEEB']} />
      <ambientLight intensity={0.6} />
      <Html center>
        <div className="text-center p-8 bg-white/90 rounded-2xl shadow-xl border-4 border-yellow-400">
          <h2 className="text-2xl font-bold text-blue-600 mb-4">Loading Game...</h2>
          <div className="w-64 h-4 bg-gray-200 rounded-full overflow-hidden mb-2">
            <div 
              className="h-full bg-gradient-to-r from-blue-500 to-green-500 transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="text-gray-600">{Math.round(progress)}%</p>
          {errors.length > 0 && (
            <p className="text-red-500 mt-2 text-sm">Error loading assets</p>
          )}
        </div>
      </Html>
    </>
  );
};

const App: React.FC = () => {
  const [gameState, setGameState] = useState<'menu' | 'character-select' | 'playing'>('menu');
  const [score, setScore] = useState(0);
  const [currentLevel, setCurrentLevel] = useState<Level>('overworld');
  const [gemsCollected, setGemsCollected] = useState(0);
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterVariant>('black');
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  
  // Control state ref to pass to the 3D loop without re-renders
  const controlsRef = useRef<Controls>({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
  });
  
  // Callbacks for level and gem updates
  const handleLevelChange = useCallback((level: Level) => {
    setCurrentLevel(level);
  }, []);
  
  const handleGemsChange = useCallback((count: number) => {
    setGemsCollected(count);
  }, []);
  
  const handleLoadingChange = useCallback((isLoading: boolean) => {
    setIsLevelLoading(isLoading);
  }, []);
  
  // Character selection handlers
  const handleNextCharacter = useCallback(() => {
    const currentIndex = CHARACTER_CONFIGS.findIndex(c => c.id === selectedCharacter);
    const nextIndex = (currentIndex + 1) % CHARACTER_CONFIGS.length;
    setSelectedCharacter(CHARACTER_CONFIGS[nextIndex].id);
  }, [selectedCharacter]);
  
  const handlePrevCharacter = useCallback(() => {
    const currentIndex = CHARACTER_CONFIGS.findIndex(c => c.id === selectedCharacter);
    const prevIndex = (currentIndex - 1 + CHARACTER_CONFIGS.length) % CHARACTER_CONFIGS.length;
    setSelectedCharacter(CHARACTER_CONFIGS[prevIndex].id);
  }, [selectedCharacter]);
  
  const handleConfirmCharacter = useCallback(() => {
    setScore(0);
    setGameState('playing');
  }, []);

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
    setGameState('character-select');
  };

  return (
    <div className={`relative w-full h-full overflow-hidden select-none font-sans ${gameState === 'character-select' ? 'bg-[#1a1a2e]' : currentLevel === 'cave' ? 'bg-[#1a1a2e]' : 'bg-[#87CEEB]'}`}>
      
      {/* 3D Scene */}
      <Canvas
        shadows
        camera={{ position: [0, 8, 12], fov: 50, near: 0.1, far: 2000 }}
        dpr={[1, 2]} // Handle high-dpi screens
        className="absolute inset-0 z-0"
        onError={(e) => console.error("Canvas Error:", e)}
      >
        <Suspense fallback={<LoadingFallback />}>
          {gameState === 'character-select' ? (
            <CharacterSelectScene 
              selectedCharacter={selectedCharacter}
              onSelectCharacter={setSelectedCharacter}
            />
          ) : (
            <Game3D 
              isPlaying={gameState === 'playing'} 
              controlsRef={controlsRef} 
              onScoreUpdate={setScore}
              onLevelChange={handleLevelChange}
              onGemsChange={handleGemsChange}
              onLoadingChange={handleLoadingChange}
              selectedCharacter={selectedCharacter}
            />
          )}
        </Suspense>
      </Canvas>

      {/* --- UI LAYER --- */}

      {/* Main Menu Overlay */}
      {gameState === 'menu' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-gradient-to-b from-white to-gray-50 p-8 rounded-2xl shadow-2xl text-center border-2 border-yellow-400 max-w-sm w-full mx-4">
            {/* Title Section */}
            <div className="mb-6">
              <h1 className="text-3xl font-black text-blue-600 leading-tight tracking-tight">
                TATCHAMASHAY
              </h1>
              <h2 className="text-xl font-bold text-orange-500 mt-1">
                Balloon Pop 3D
              </h2>
            </div>
            
            {/* Play Button */}
            <button 
              onClick={startGame}
              className="bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white text-2xl font-bold py-4 px-10 rounded-xl shadow-lg transform transition-all duration-150 active:scale-95 flex items-center justify-center gap-3 mx-auto border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
            >
              <Play fill="currentColor" size={28} /> PLAY
            </button>

            {/* Divider */}
            <div className="my-6 border-t border-gray-200"></div>

            {/* Controls Info */}
            <div className="text-gray-600 text-sm space-y-1">
              <p className="flex items-center justify-center gap-2">
                <span className="bg-gray-200 px-2 py-0.5 rounded font-mono text-xs">WASD</span>
                <span>or Joystick to Move</span>
              </p>
              <p className="flex items-center justify-center gap-2">
                <span className="bg-gray-200 px-2 py-0.5 rounded font-mono text-xs">SPACE</span>
                <span>to Pop Balloons</span>
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Character Selection Overlay */}
      {gameState === 'character-select' && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-between py-8 pointer-events-none">
          {/* Title */}
          <div className="text-center pointer-events-auto">
            <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-wide">
              SELECT YOUR CHARACTER
            </h1>
            <p className="text-purple-300 mt-2 text-lg">
              Choose your warrior
            </p>
          </div>
          
          {/* Navigation Arrows - positioned on sides, lower on screen */}
          <div className="absolute left-8 top-[60%] -translate-y-1/2 pointer-events-auto">
            <button
              onClick={handlePrevCharacter}
              className="w-16 h-16 bg-purple-600/80 hover:bg-purple-500 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-purple-400 transition-all hover:scale-110"
            >
              <ChevronLeft size={32} />
            </button>
          </div>
          
          <div className="absolute right-8 top-[60%] -translate-y-1/2 pointer-events-auto">
            <button
              onClick={handleNextCharacter}
              className="w-16 h-16 bg-purple-600/80 hover:bg-purple-500 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-purple-400 transition-all hover:scale-110"
            >
              <ChevronRight size={32} />
            </button>
          </div>
          
          {/* Spacer for the 3D character view */}
          <div className="flex-1" />
          
          {/* Bottom section: Character Info + Confirm Button */}
          <div className="pointer-events-auto flex flex-col items-center gap-4">
            {/* Character Info Card */}
            <div className="bg-gradient-to-b from-gray-900/90 to-purple-900/90 backdrop-blur-md p-4 px-8 rounded-2xl shadow-2xl border-2 border-purple-500/50 text-center min-w-[280px]">
              {(() => {
                const config = CHARACTER_CONFIGS.find(c => c.id === selectedCharacter);
                return config ? (
                  <>
                    <h2 className="text-2xl font-bold text-white mb-1">
                      {config.name}
                    </h2>
                    <p className="text-purple-200 text-sm mb-3">
                      {config.description}
                    </p>
                    <div className="flex justify-center gap-2">
                      {CHARACTER_CONFIGS.map((c, i) => (
                        <div
                          key={c.id}
                          className={`w-3 h-3 rounded-full transition-all ${
                            c.id === selectedCharacter 
                              ? 'bg-purple-400 scale-125' 
                              : 'bg-gray-600'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                ) : null;
              })()}
            </div>
            
            {/* Confirm Button */}
            <button
              onClick={handleConfirmCharacter}
              className="bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white text-2xl font-bold py-4 px-12 rounded-xl shadow-lg transform transition-all duration-150 active:scale-95 flex items-center justify-center gap-3 border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
            >
              <Play fill="currentColor" size={28} /> START GAME
            </button>
            
            {/* Back to menu */}
            <button
              onClick={() => setGameState('menu')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Menu
            </button>
          </div>
        </div>
      )}

      {/* Level Loading Overlay */}
      {gameState === 'playing' && isLevelLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
          <div className={`p-8 rounded-2xl shadow-2xl text-center ${
            currentLevel === 'cave' 
              ? 'bg-gradient-to-b from-gray-900 to-purple-900 border-4 border-purple-500' 
              : 'bg-gradient-to-b from-white to-gray-100 border-4 border-yellow-400'
          }`}>
            <div className="text-5xl mb-4">
              {currentLevel === 'cave' ? '🌅' : '🦇'}
            </div>
            <h2 className={`text-2xl font-bold mb-2 ${
              currentLevel === 'cave' ? 'text-purple-300' : 'text-blue-600'
            }`}>
              {currentLevel === 'cave' ? 'Returning to Surface...' : 'Entering the Cave...'}
            </h2>
            <div className={`w-48 h-3 rounded-full overflow-hidden ${
              currentLevel === 'cave' ? 'bg-purple-800' : 'bg-gray-200'
            }`}>
              <div 
                className={`h-full animate-pulse ${
                  currentLevel === 'cave' 
                    ? 'bg-gradient-to-r from-purple-500 to-pink-500' 
                    : 'bg-gradient-to-r from-blue-500 to-green-500'
                }`}
                style={{ width: '100%' }}
              />
            </div>
          </div>
        </div>
      )}

      {/* HUD (Heads Up Display) */}
      {gameState === 'playing' && (
        <>
          {/* Score & Menu Button */}
          <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
            <div className="flex gap-3">
              {/* Score display */}
              <div className="bg-white/80 backdrop-blur-md rounded-2xl p-3 px-6 shadow-xl border-4 border-yellow-400 transform transition-transform">
                <span className="text-yellow-600 font-bold text-xl uppercase tracking-wider block text-xs">Score</span>
                <span className="text-4xl font-black text-gray-800">{score}</span>
              </div>
              
              {/* Gem counter - only show in cave */}
              {currentLevel === 'cave' && (
                <div className="bg-purple-900/80 backdrop-blur-md rounded-2xl p-3 px-6 shadow-xl border-4 border-purple-400 transform transition-transform">
                  <span className="text-purple-300 font-bold text-xl uppercase tracking-wider block text-xs">Gems</span>
                  <div className="flex items-center gap-2">
                    <Gem size={24} className="text-purple-300" />
                    <span className="text-4xl font-black text-white">{gemsCollected}</span>
                  </div>
                </div>
              )}
              
              {/* Level indicator */}
              {currentLevel === 'cave' && (
                <div className="bg-gray-800/80 backdrop-blur-md rounded-2xl p-3 px-4 shadow-xl border-2 border-gray-600">
                  <span className="text-gray-400 font-bold text-xs uppercase">Location</span>
                  <span className="text-lg font-bold text-white block">Cave</span>
                </div>
              )}
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
          <div className={`hidden sm:block absolute bottom-6 left-6 backdrop-blur p-4 rounded-xl border pointer-events-none ${currentLevel === 'cave' ? 'bg-purple-900/40 text-purple-100 border-purple-500/30' : 'bg-white/20 text-white border-white/30'}`}>
            <p className="font-bold text-lg mb-1">Controls</p>
            <div className="flex items-center gap-2 text-sm"><span className="bg-white/20 px-2 py-1 rounded">WASD</span> Move</div>
            {currentLevel === 'cave' ? (
              <>
                <div className="flex items-center gap-2 text-sm mt-1"><span className="bg-white/20 px-2 py-1 rounded">SPACE</span> Kick Potato</div>
                <div className="flex items-center gap-2 text-sm mt-1 text-purple-300">Walk into gems to collect</div>
              </>
            ) : (
              <div className="flex items-center gap-2 text-sm mt-1"><span className="bg-white/20 px-2 py-1 rounded">SPACE</span> Pop Balloon</div>
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default App;