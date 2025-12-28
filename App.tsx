import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { ArrowUp, ArrowDown, ArrowLeft, ArrowRight, Sword, Play, RotateCcw, Gem, ChevronLeft, ChevronRight, Users, Copy, Check, Loader2, Crown } from 'lucide-react';
import { Canvas, ThreeElements } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Controls, Level, CharacterVariant, CHARACTER_CONFIGS, LEVEL_CONFIGS } from './game/types';
import { CharacterSelectScene } from './game/components/CharacterSelect';
import { LevelSelectScene } from './game/components/LevelSelect';
import Game3D from './game/Game3D';
import { useMultiplayer } from './game/multiplayer';
import { LandingPage } from './game/components/LandingPage';
import { AboutPage } from './game/components/AboutPage';

// Augment React's JSX namespace to include Three.js elements
declare global {
  namespace React {
    namespace JSX {
      interface IntrinsicElements extends ThreeElements {}
    }
  }
}

// Simple loading fallback for 3D scenes
const LoadingFallback = () => (
  <Html center>
    <div className="flex items-center justify-center w-full h-full">
      <div className="text-white text-xl bg-black/50 px-4 py-2 rounded">Loading...</div>
    </div>
  </Html>
);


// Lobby component for multiplayer room management
const LobbyOverlay: React.FC<{
  playerName: string;
  setPlayerName: (name: string) => void;
  selectedCharacter: CharacterVariant;
  selectedLevel: Level;
  onBack: () => void;
  onStartGame: () => void;
}> = ({ playerName, setPlayerName, selectedCharacter, selectedLevel, onBack, onStartGame }) => {
  const {
    isConnected,
    isConnecting,
    roomCode,
    isHost,
    remotePlayers,
    playerCount,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    gameStarted,
  } = useMultiplayer();

  const [joinCode, setJoinCode] = useState('');
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showMultiplayer, setShowMultiplayer] = useState(false);

  // When game starts from server, trigger the game start
  useEffect(() => {
    if (gameStarted && isConnected) {
      onStartGame();
    }
  }, [gameStarted, isConnected, onStartGame]);

  const handleCreateRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    setError(null);
    try {
      await createRoom(playerName.trim(), selectedCharacter);
    } catch (e) {
      setError('Failed to create room. Please try again.');
    }
  };

  const handleJoinRoom = async () => {
    if (!playerName.trim()) {
      setError('Please enter your name');
      return;
    }
    if (!joinCode.trim() || joinCode.length !== 4) {
      setError('Please enter a valid 4-letter room code');
      return;
    }
    setError(null);
    try {
      await joinRoom(joinCode.trim().toUpperCase(), playerName.trim(), selectedCharacter);
    } catch (e) {
      setError('Failed to join room. Check the code and try again.');
    }
  };

  const handleCopyCode = () => {
    if (roomCode) {
      navigator.clipboard.writeText(roomCode);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleStartGame = () => {
    startGame();
  };

  const handleLeave = () => {
    leaveRoom();
    onBack();
  };

  // Connected to a room - show room info and players
  if (isConnected && roomCode) {
    return (
      <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
        <div className="bg-gradient-to-b from-gray-900 to-purple-900 p-8 rounded-2xl shadow-2xl border-2 border-purple-500 max-w-md w-full mx-4">
          {/* Room Code Display */}
          <div className="text-center mb-6">
            <p className="text-purple-300 text-sm uppercase tracking-wider mb-2">Room Code</p>
            <div className="flex items-center justify-center gap-3">
              <span className="text-5xl font-black text-white tracking-[0.3em]">{roomCode}</span>
              <button
                onClick={handleCopyCode}
                className="p-2 bg-purple-600 hover:bg-purple-500 rounded-lg transition-colors"
              >
                {copied ? <Check size={20} className="text-green-400" /> : <Copy size={20} className="text-white" />}
              </button>
            </div>
            <p className="text-purple-400 text-sm mt-2">Share this code with friends!</p>
            <div className="text-center mt-4 p-3 bg-gray-800/50 rounded-lg">
              <p className="text-gray-300 text-sm">
                Level: <span className="text-purple-300 font-bold">
                  {LEVEL_CONFIGS.find(l => l.id === selectedLevel)?.name || 'Unknown'}
                </span>
              </p>
            </div>
          </div>

          {/* Players List */}
          <div className="mb-6">
            <div className="flex items-center gap-2 mb-3">
              <Users size={20} className="text-purple-300" />
              <span className="text-purple-300 font-bold">Players ({playerCount}/4)</span>
            </div>
            <div className="space-y-2">
              {/* Current player (you) */}
              <div className="flex items-center gap-3 bg-purple-800/50 p-3 rounded-lg border border-purple-500">
                <div 
                  className="w-8 h-8 rounded-full" 
                  style={{ backgroundColor: CHARACTER_CONFIGS.find(c => c.id === selectedCharacter)?.cloakColor || '#6B21A8' }}
                />
                <span className="text-white font-medium flex-1">{playerName} (You)</span>
                {isHost && <Crown size={18} className="text-yellow-400" />}
              </div>
              
              {/* Remote players */}
              {Array.from(remotePlayers.values()).map(player => (
                <div key={player.id} className="flex items-center gap-3 bg-gray-800/50 p-3 rounded-lg border border-gray-600">
                  <div 
                    className="w-8 h-8 rounded-full" 
                    style={{ backgroundColor: CHARACTER_CONFIGS.find(c => c.id === player.characterVariant)?.cloakColor || '#6B21A8' }}
                  />
                  <span className="text-gray-200 font-medium flex-1">{player.name}</span>
                </div>
              ))}
              
              {/* Empty slots */}
              {Array.from({ length: 4 - playerCount }).map((_, i) => (
                <div key={`empty-${i}`} className="flex items-center gap-3 bg-gray-900/30 p-3 rounded-lg border border-gray-700 border-dashed">
                  <div className="w-8 h-8 rounded-full bg-gray-700" />
                  <span className="text-gray-500 font-medium">Waiting for player...</span>
                </div>
              ))}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            {isHost ? (
              <button
                onClick={handleStartGame}
                disabled={playerCount < 1}
                className="w-full bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 disabled:from-gray-500 disabled:to-gray-600 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-3"
              >
                <Play fill="currentColor" size={24} /> Start Game
              </button>
            ) : (
              <div className="text-center py-4 text-purple-300">
                <Loader2 className="animate-spin inline-block mr-2" size={20} />
                Waiting for host to start...
              </div>
            )}
            
            <button
              onClick={handleLeave}
              className="w-full bg-gray-700 hover:bg-gray-600 text-white py-3 rounded-xl transition-colors"
            >
              Leave Room
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Not connected - show create/join options
  return (
    <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-gradient-to-b from-gray-900 to-purple-900 p-8 rounded-2xl shadow-2xl border-2 border-purple-500 max-w-md w-full mx-4">
        <h2 className="text-3xl font-black text-white text-center mb-2">Choose Your Game Mode</h2>
        <p className="text-purple-300 text-center mb-6">Play alone or with friends!</p>

        {/* Play Solo Button - Primary Action */}
        <button
          onClick={onStartGame}
          className="w-full bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 mb-6"
        >
          <Play fill="currentColor" size={24} /> Play Solo
        </button>

        {/* Divider */}
        <div className="flex items-center gap-4 my-6">
          <div className="flex-1 h-px bg-purple-700" />
          <span className="text-purple-400 text-sm">OR</span>
          <div className="flex-1 h-px bg-purple-700" />
        </div>

        {/* Multiplayer Button */}
        <button
          onClick={() => setShowMultiplayer(!showMultiplayer)}
          className="w-full bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 text-white text-xl font-bold py-4 rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 mb-4"
        >
          <Users size={24} /> Play with Friends
        </button>

        {/* Multiplayer Section - Expandable */}
        {showMultiplayer && (
          <>
            {/* Player Name Input */}
            <div className="mb-6">
              <label className="text-purple-300 text-sm block mb-2">Your Name</label>
              <input
                type="text"
                value={playerName}
                onChange={(e) => setPlayerName(e.target.value.slice(0, 16))}
                placeholder="Enter your name"
                className="w-full px-4 py-3 bg-gray-800 border border-purple-500 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400"
                maxLength={16}
              />
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-300 text-sm text-center">
                {error}
              </div>
            )}

            {/* Create Room Button */}
            <button
              onClick={handleCreateRoom}
              disabled={isConnecting}
              className="w-full bg-gradient-to-b from-purple-500 to-purple-700 hover:from-purple-400 hover:to-purple-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg font-bold py-3 rounded-xl shadow-lg mb-4 transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isConnecting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                <>
                  <Users size={20} /> Create Room
                </>
              )}
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-4">
              <div className="flex-1 h-px bg-purple-700" />
              <span className="text-purple-400 text-sm">OR</span>
              <div className="flex-1 h-px bg-purple-700" />
            </div>

            {/* Join Room */}
            <div className="mb-4">
              <label className="text-purple-300 text-sm block mb-2">Room Code</label>
              <input
                type="text"
                value={joinCode}
                onChange={(e) => setJoinCode(e.target.value.toUpperCase().slice(0, 4))}
                placeholder="XXXX"
                className="w-full px-4 py-3 bg-gray-800 border border-purple-500 rounded-xl text-white text-center text-2xl tracking-[0.3em] placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-400 uppercase"
                maxLength={4}
              />
            </div>

            <button
              onClick={handleJoinRoom}
              disabled={isConnecting || joinCode.length !== 4}
              className="w-full bg-gradient-to-b from-blue-500 to-blue-700 hover:from-blue-400 hover:to-blue-600 disabled:from-gray-500 disabled:to-gray-600 text-white text-lg font-bold py-3 rounded-xl shadow-lg transition-all disabled:cursor-not-allowed flex items-center justify-center gap-2 mb-4"
            >
              {isConnecting ? (
                <Loader2 className="animate-spin" size={20} />
              ) : (
                'Join Room'
              )}
            </button>
          </>
        )}

        {/* Back Button */}
        <button
          onClick={onBack}
          className="w-full mt-4 text-gray-400 hover:text-white transition-colors py-2"
        >
          ← Back to Character Select
        </button>
      </div>
    </div>
  );
};


// Simple app with basic navigation
const AppContent: React.FC = () => {
  const [gameState, setGameState] = useState<'menu' | 'about' | 'character-select' | 'level-select' | 'lobby' | 'playing'>('menu');
  const [selectedCharacter, setSelectedCharacter] = useState<CharacterVariant>('black');
  const [selectedLevel, setSelectedLevel] = useState<Level>('overworld');
  const [playerName, setPlayerName] = useState('');
  const [score, setScore] = useState(0);
  const [isLevelLoading, setIsLevelLoading] = useState(false);

  // Control state ref to pass to the 3D loop without re-renders
  const controlsRef = useRef<Controls>({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
  });

  // Callbacks for level and gem updates (moved to top level)

  const handleLoadingChange = useCallback((isLoading: boolean) => {
    setIsLevelLoading(isLoading);
  }, []);

  // Keyboard listeners for game controls (moved to top level)
  // Handle keyboard input for character select
  useEffect(() => {
    if (gameState !== 'character-select') return;

    const handleKeyDown = (e: any) => {
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevCharacter();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextCharacter();
          break;
        case 'Enter':
          e.preventDefault();
          handleConfirmCharacter();
          break;
      }
    };

    (window as any).addEventListener('keydown', handleKeyDown);
    return () => {
      (window as any).removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, selectedCharacter]);

  // Handle keyboard input for level select
  useEffect(() => {
    if (gameState !== 'level-select') return;

    const handleKeyDown = (e: any) => {
      switch (e.code) {
        case 'ArrowLeft':
          e.preventDefault();
          handlePrevLevel();
          break;
        case 'ArrowRight':
          e.preventDefault();
          handleNextLevel();
          break;
        case 'Enter':
        case 'Space':
          e.preventDefault();
          handleConfirmLevel();
          break;
      }
    };

    (window as any).addEventListener('keydown', handleKeyDown);
    return () => {
      (window as any).removeEventListener('keydown', handleKeyDown);
    };
  }, [gameState, selectedLevel]);


  useEffect(() => {
    if (gameState !== 'playing') return;

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
  }, [gameState]);

  const startGame = () => {
    console.log('startGame called, setting gameState to character-select');
    setGameState('character-select');
    console.log('gameState should now be character-select');
  };

  const handleNextCharacter = () => {
    const currentIndex = CHARACTER_CONFIGS.findIndex(c => c.id === selectedCharacter);
    const nextIndex = (currentIndex + 1) % CHARACTER_CONFIGS.length;
    setSelectedCharacter(CHARACTER_CONFIGS[nextIndex].id);
  };

  const handlePrevCharacter = () => {
    const currentIndex = CHARACTER_CONFIGS.findIndex(c => c.id === selectedCharacter);
    const prevIndex = (currentIndex - 1 + CHARACTER_CONFIGS.length) % CHARACTER_CONFIGS.length;
    setSelectedCharacter(CHARACTER_CONFIGS[prevIndex].id);
  };

  const handleConfirmCharacter = () => {
    console.log('handleConfirmCharacter called, setting gameState to level-select');
    setGameState('level-select');
    console.log('gameState should now be level-select');
  };

  const handleNextLevel = () => {
    const currentIndex = LEVEL_CONFIGS.findIndex(l => l.id === selectedLevel);
    const nextIndex = (currentIndex + 1) % LEVEL_CONFIGS.length;
    setSelectedLevel(LEVEL_CONFIGS[nextIndex].id);
  };

  const handlePrevLevel = () => {
    const currentIndex = LEVEL_CONFIGS.findIndex(l => l.id === selectedLevel);
    const prevIndex = (currentIndex - 1 + LEVEL_CONFIGS.length) % LEVEL_CONFIGS.length;
    setSelectedLevel(LEVEL_CONFIGS[prevIndex].id);
  };

  const handleConfirmLevel = () => {
    console.log('handleConfirmLevel called, setting gameState to lobby');
    setGameState('lobby');
    console.log('gameState should now be lobby');
  };


  const handleReturnToMenu = () => {
    setGameState('menu');
  };

  const handleAbout = () => {
    setGameState('about');
  };

  // Main menu
  if (gameState === 'menu') {
    return <LandingPage onPlay={startGame} onAbout={handleAbout} />;
  }

  // About page
  if (gameState === 'about') {
    return <AboutPage onBack={handleReturnToMenu} />;
  }

  // Character select with 3D scene
  if (gameState === 'character-select') {
    const currentConfig = CHARACTER_CONFIGS.find(c => c.id === selectedCharacter);

    return (
      <div className={`relative w-full h-screen bg-[#1a1a2e]`}>
        {/* 3D Character Scene */}
        <Canvas
          shadows
          camera={{ position: [0, 2, 5], fov: 50 }}
          className="absolute inset-0"
        >
          <Suspense fallback={<LoadingFallback />}>
            <CharacterSelectScene
              selectedCharacter={selectedCharacter}
              onSelectCharacter={setSelectedCharacter}
            />
          </Suspense>
        </Canvas>

        {/* UI Overlay */}
        <div className="absolute inset-0 z-50 flex flex-col items-center pointer-events-none">
          {/* Navbar */}
          <nav className="w-full pointer-events-auto bg-slate-900/80 backdrop-blur-md border-b border-white/10 h-20 flex-none z-50">
            <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
              <div className="cursor-pointer" onClick={() => { handleReturnToMenu(); window.scrollTo({ top: 0, behavior: 'smooth' }); }}>
                <h1 className="text-2xl font-black bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
                  TATCHAMASHAY
                </h1>
              </div>
              <button 
                onClick={handleReturnToMenu}
                className="text-gray-300 hover:text-white px-3 py-2 rounded-md text-sm font-medium transition-colors"
              >
                Home
              </button>
            </div>
          </nav>
          
          <div className="flex-1 w-full flex flex-col items-center justify-between py-8 relative">
            <div className="text-center pointer-events-auto">
              <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-wide">
                SELECT YOUR CHARACTER
              </h1>
              <p className="text-purple-300 mt-2 text-lg">
                Choose your warrior
              </p>
            </div>

            {/* Navigation Arrows */}
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

            <div className="flex-1" />

            <div className="pointer-events-auto flex flex-col items-center gap-4">
              <div className="bg-gradient-to-b from-gray-900/90 to-purple-900/90 backdrop-blur-md p-4 px-8 rounded-2xl shadow-2xl border-2 border-purple-500/50 text-center min-w-[280px]">
                <h2 className="text-2xl font-bold text-white mb-1">
                  {currentConfig?.name || 'Unknown'}
                </h2>
                <p className="text-purple-200 text-sm mb-3">
                  {currentConfig?.description || 'No description'}
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
              </div>

              <button
                onClick={handleConfirmCharacter}
                className="bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white text-lg font-bold py-4 px-16 rounded-xl shadow-lg flex items-center justify-center gap-3"
              >
                <Play fill="currentColor" size={28} /> CHOOSE CHARACTER
              </button>

              <button
                onClick={handleReturnToMenu}
                className="text-gray-400 hover:text-white transition-colors"
              >
                ← Back to Menu
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Level select with 3D scene
  if (gameState === 'level-select') {
    const currentLevelConfig = LEVEL_CONFIGS.find(l => l.id === selectedLevel);
    const bgColor = selectedLevel === 'cave' ? '#0a0908' : '#87CEEB';

    return (
      <div className="relative w-full h-screen" style={{ backgroundColor: bgColor }}>
        {/* 3D Level Scene */}
        <Canvas
          shadows
          camera={{ position: [0, 8, 12], fov: 50, near: 0.1, far: 2000 }}
          className="absolute inset-0"
        >
          <Suspense fallback={<LoadingFallback />}>
            <LevelSelectScene
              selectedLevel={selectedLevel}
              onSelectLevel={setSelectedLevel}
            />
          </Suspense>
        </Canvas>

        {/* UI Overlay */}
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-between py-8 pointer-events-none">
          <div className="text-center pointer-events-auto">
            <h1 className="text-4xl font-black text-white drop-shadow-lg tracking-wide">
              SELECT YOUR LEVEL
            </h1>
            <p className="text-purple-300 mt-2 text-lg">
              Choose your adventure world
            </p>
          </div>

          {/* Navigation Arrows */}
          <div className="absolute left-8 top-[60%] -translate-y-1/2 pointer-events-auto">
            <button
              onClick={handlePrevLevel}
              className="w-16 h-16 bg-purple-600/80 hover:bg-purple-500 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-purple-400 transition-all hover:scale-110"
            >
              <ChevronLeft size={32} />
            </button>
          </div>

          <div className="absolute right-8 top-[60%] -translate-y-1/2 pointer-events-auto">
            <button
              onClick={handleNextLevel}
              className="w-16 h-16 bg-purple-600/80 hover:bg-purple-500 text-white rounded-full flex items-center justify-center shadow-xl border-2 border-purple-400 transition-all hover:scale-110"
            >
              <ChevronRight size={32} />
            </button>
          </div>

          <div className="flex-1" />

          <div className="pointer-events-auto flex flex-col items-center gap-4">
            <div className="bg-gradient-to-b from-gray-900/90 to-purple-900/90 backdrop-blur-md p-4 px-8 rounded-2xl shadow-2xl border-2 border-purple-500/50 text-center min-w-[280px]">
              <h2 className="text-2xl font-bold text-white mb-1">
                {currentLevelConfig?.name || 'Unknown Level'}
              </h2>
              <p className="text-purple-200 text-sm mb-3">
                {currentLevelConfig?.description || 'No description'}
              </p>
              <div className="flex justify-center gap-2">
                {LEVEL_CONFIGS.map((l) => (
                  <div
                    key={l.id}
                    className={`w-3 h-3 rounded-full transition-all ${
                      l.id === selectedLevel
                        ? 'bg-purple-400 scale-125'
                        : 'bg-gray-600'
                    }`}
                  />
                ))}
              </div>
            </div>

            <button
              onClick={handleConfirmLevel}
              className="bg-gradient-to-b from-green-400 to-green-600 hover:from-green-500 hover:to-green-700 text-white text-2xl font-bold py-4 px-12 rounded-xl shadow-lg transform transition-all duration-150 active:scale-95 flex items-center justify-center gap-3 border-b-4 border-green-700 active:border-b-0 active:translate-y-1"
            >
              <Play fill="currentColor" size={28} /> START GAME
            </button>

            <button
              onClick={() => setGameState('character-select')}
              className="text-gray-400 hover:text-white transition-colors"
            >
              ← Back to Character Select
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Lobby for multiplayer setup
  if (gameState === 'lobby') {
    return (
      <div className="relative w-full h-screen bg-[#87CEEB]">
        {/* 3D Character Scene */}
        <Canvas
          shadows
          camera={{ position: [0, 2, 6], fov: 50, near: 0.1, far: 2000 }}
          className="absolute inset-0"
        >
          <Suspense fallback={<LoadingFallback />}>
            <CharacterSelectScene
              selectedCharacter={selectedCharacter}
              onSelectCharacter={setSelectedCharacter}
            />
          </Suspense>
        </Canvas>

        <LobbyOverlay
          playerName={playerName}
          setPlayerName={setPlayerName}
          selectedCharacter={selectedCharacter}
          selectedLevel={selectedLevel}
          onBack={() => setGameState('level-select')}
          onStartGame={() => setGameState('playing')}
        />
      </div>
    );
  }

  // Game playing with full 3D scene
  if (gameState === 'playing') {
    return (
      <div className="relative w-full h-full overflow-hidden select-none font-sans bg-[#87CEEB]">
        {/* 3D Game Scene */}
        <Canvas
          shadows
          camera={{ position: [0, 8, 12], fov: 50, near: 0.1, far: 2000 }}
          dpr={[1, 2]}
          className="absolute inset-0 z-0"
          onError={(e) => console.error("Canvas Error:", e)}
        >
          <Suspense fallback={<LoadingFallback />}>
            <Game3D
              isPlaying={true}
              controlsRef={controlsRef}
              onScoreUpdate={setScore}
              onLoadingChange={handleLoadingChange}
              selectedCharacter={selectedCharacter}
              selectedLevel={selectedLevel}
            />
          </Suspense>
        </Canvas>

        {/* HUD (Heads Up Display) */}
        <div className="absolute top-4 left-4 right-4 flex justify-between items-start z-10 pointer-events-none">
          <div className="flex gap-3">
            {/* Score display */}
            <div className="bg-white/80 backdrop-blur-md rounded-2xl p-3 px-6 shadow-xl border-4 border-yellow-400 transform transition-transform">
              <span className="text-yellow-600 font-bold text-xl uppercase tracking-wider block text-xs">Score</span>
              <span className="text-4xl font-black text-gray-800">{score}</span>
            </div>

          </div>

          <button
            onClick={handleReturnToMenu}
            className="pointer-events-auto bg-red-500 hover:bg-red-600 text-white p-3 rounded-xl shadow-lg border-b-4 border-red-700 active:border-b-0 active:translate-y-1"
            title="Return to Menu"
          >
            <span className="text-sm">MENU</span>
          </button>
        </div>

        {/* Level Loading Overlay */}
        {isLevelLoading && (
          <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="p-8 rounded-2xl shadow-2xl text-center bg-gradient-to-b from-white to-gray-100 border-4 border-yellow-400">
              <div className="text-5xl mb-4">
                🦇
              </div>
              <h2 className="text-2xl font-bold mb-2 text-blue-600">
                Loading Game...
              </h2>
              <div className="w-48 h-3 rounded-full overflow-hidden bg-gray-200">
                <div
                  className="h-full animate-pulse bg-gradient-to-r from-blue-500 to-green-500"
                  style={{ width: '100%' }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Desktop Helper */}
        <div className="hidden sm:block absolute bottom-6 left-6 backdrop-blur p-4 rounded-xl border pointer-events-none bg-white/20 text-white border-white/30">
          <p className="font-bold text-lg mb-1">Controls</p>
          <div className="flex items-center gap-2 text-sm"><span className="bg-white/20 px-2 py-1 rounded">WASD</span> Move</div>
          <div className="flex items-center gap-2 text-sm mt-1"><span className="bg-white/20 px-2 py-1 rounded">SPACE</span> Pop Balloon</div>
          <div className="flex items-center gap-2 text-sm mt-1"><span className="bg-white/20 px-2 py-1 rounded">DRAG</span> Rotate Camera</div>
        </div>
      </div>
    );
  }

  // This should never be reached
  return null;
};

// Simple MultiplayerProvider stub
const MultiplayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return <>{children}</>;
};

// Main App component with simple MultiplayerProvider
const App: React.FC = () => {
  return (
    <MultiplayerProvider>
      <AppContent />
    </MultiplayerProvider>
  );
};

export default App;