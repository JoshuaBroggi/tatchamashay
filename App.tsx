import React, { useState, useRef, useEffect, Suspense, useCallback } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import { Canvas, ThreeElements } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { Controls, Level } from './game/types';
import Game3D from './game/Game3D';
import { MultiplayerProvider, useMultiplayer } from './game/multiplayer';
import { LandingPage } from './game/components/LandingPage';
import { AboutPage } from './game/components/AboutPage';
import { getQualitySettings } from './game/world/quality';
import { DEFAULT_EXPLORER, ExplorerRoleId, getExpedition, getExplorerRole, roleForCharacter } from './game/expedition';
import { TitleScreen } from './game/screens/TitleScreen';
import { ExplorerSelect } from './game/screens/ExplorerSelect';
import { ExpeditionSelect } from './game/screens/ExpeditionSelect';
import { CrewLobby } from './game/screens/CrewLobby';
import { ExpeditionHUD, HudCrewMember } from './game/screens/ExpeditionHUD';
import { ResultsScreen, ExpeditionRun } from './game/screens/ResultsScreen';

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
    <div className="tm-eyebrow whitespace-nowrap bg-panel px-4 py-2 text-ink-soft">Loading…</div>
  </Html>
);

const readSavedName = (): string => {
  try {
    return localStorage.getItem('tm-player-name') ?? '';
  } catch {
    return '';
  }
};

// Shared state context for the game
interface GameContextType {
  explorerId: ExplorerRoleId;
  setExplorerId: (id: ExplorerRoleId) => void;
  selectedLevel: Level;
  setSelectedLevel: (level: Level) => void;
  playerName: string;
  setPlayerName: (name: string) => void;
  score: number;
  setScore: React.Dispatch<React.SetStateAction<number>>;
  controlsRef: React.MutableRefObject<Controls>;
  lastRun: ExpeditionRun | null;
  setLastRun: (run: ExpeditionRun | null) => void;
}

const GameContext = React.createContext<GameContextType | null>(null);

const useGameContext = () => {
  const context = React.useContext(GameContext);
  if (!context) {
    throw new Error('useGameContext must be used within a GameProvider');
  }
  return context;
};

// Route Components
const CharacterSelectRoute: React.FC = () => {
  const { explorerId, setExplorerId } = useGameContext();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const fromLobby = params.get('from') === 'lobby';

  const handleBack = useCallback(() => navigate(fromLobby ? '/lobby' : '/'), [navigate, fromLobby]);
  const handleContinue = useCallback(() => navigate(fromLobby ? '/lobby' : '/level-select'), [navigate, fromLobby]);

  return (
    <ExplorerSelect
      explorerId={explorerId}
      onPick={setExplorerId}
      onBack={handleBack}
      backLabel={fromLobby ? 'Base camp' : 'Back'}
      onContinue={handleContinue}
      continueLabel={fromLobby ? 'Back to base camp' : 'Choose expedition →'}
      stepLabel={fromLobby ? undefined : 'Step 1 / 2'}
    />
  );
};

const LevelSelectRoute: React.FC = () => {
  const { selectedLevel, setSelectedLevel } = useGameContext();
  const { roomCode } = useMultiplayer();
  const navigate = useNavigate();

  // In a crew, the leader starts from base camp so everyone launches together.
  const handleEmbark = useCallback(() => navigate(roomCode ? '/lobby' : '/game'), [navigate, roomCode]);

  return (
    <ExpeditionSelect
      level={selectedLevel}
      onPick={setSelectedLevel}
      onBack={() => navigate('/character-select')}
      onInviteCrew={() => navigate('/lobby')}
      onEmbark={handleEmbark}
    />
  );
};

const LobbyRoute: React.FC = () => {
  const { explorerId, selectedLevel, setSelectedLevel, playerName, setPlayerName } = useGameContext();
  const navigate = useNavigate();
  const [params] = useSearchParams();

  const handleExpeditionStart = useCallback((level: Level) => {
    setSelectedLevel(level);
    navigate('/game');
  }, [navigate, setSelectedLevel]);

  return (
    <CrewLobby
      playerName={playerName}
      setPlayerName={setPlayerName}
      explorerId={explorerId}
      level={selectedLevel}
      onLevelSync={setSelectedLevel}
      initialCode={params.get('code') ?? ''}
      onLeave={() => navigate('/')}
      onChangeExplorer={() => navigate('/character-select?from=lobby')}
      onChangeExpedition={() => navigate('/level-select')}
      onExpeditionStart={handleExpeditionStart}
    />
  );
};

const GameRoute: React.FC = () => {
  const { explorerId, selectedLevel, score, setScore, controlsRef, playerName, setLastRun } = useGameContext();
  const { roomCode, isHost, playerId, hostId, remotePlayers, leaveRoom } = useMultiplayer();
  const [isLevelLoading, setIsLevelLoading] = useState(false);
  const [startedAt] = useState(() => Date.now());
  const navigate = useNavigate();
  const explorer = getExplorerRole(explorerId);
  const expedition = getExpedition(selectedLevel);

  useEffect(() => {
    setScore(0);
  }, [setScore]);

  const handleLoadingChange = useCallback((isLoading: boolean) => {
    setIsLevelLoading(isLoading);
  }, []);

  const crew: HudCrewMember[] = Array.from(remotePlayers.values()).map(p => ({
    id: p.id,
    name: p.name,
    role: roleForCharacter(p.characterVariant)?.role ?? 'Explorer',
  }));

  const handleEndExpedition = () => {
    setLastRun({
      level: selectedLevel,
      score,
      durationMs: Date.now() - startedAt,
      crew: [
        { id: playerId ?? 'you', name: playerName.trim() || 'You', role: explorer.role, isYou: true, isLeader: roomCode !== null && isHost },
        ...crew.map(m => ({ ...m, isYou: false, isLeader: m.id === hostId })),
      ],
    });
    // Ending your expedition leaves the crew; the others keep playing.
    if (roomCode) leaveRoom();
    navigate('/results');
  };

  const handleLeave = () => {
    if (roomCode) leaveRoom();
    navigate('/');
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': controlsRef.current.up = true; break;
        case 'KeyS': case 'ArrowDown': controlsRef.current.down = true; break;
        case 'KeyA': case 'ArrowLeft': controlsRef.current.left = true; break;
        case 'KeyD': case 'ArrowRight': controlsRef.current.right = true; break;
        case 'Space': controlsRef.current.attack = true; break;
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      switch (e.code) {
        case 'KeyW': case 'ArrowUp': controlsRef.current.up = false; break;
        case 'KeyS': case 'ArrowDown': controlsRef.current.down = false; break;
        case 'KeyA': case 'ArrowLeft': controlsRef.current.left = false; break;
        case 'KeyD': case 'ArrowRight': controlsRef.current.right = false; break;
        case 'Space': controlsRef.current.attack = false; break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [controlsRef]);

  return (
    <div className="relative h-full w-full select-none overflow-hidden bg-ground font-body">
      {/* 3D Game Scene - quality-driven DPR */}
      <Canvas
        shadows={getQualitySettings().shadowsEnabled}
        camera={{ position: [0, 8, 12], fov: 50, near: 0.1, far: 2000 }}
        dpr={getQualitySettings().dprRange}
        className="absolute inset-0 z-0"
        onError={(e) => console.error("Canvas Error:", e)}
      >
        <Suspense fallback={<LoadingFallback />}>
          <Game3D
            isPlaying={true}
            controlsRef={controlsRef}
            onScoreUpdate={setScore}
            onLoadingChange={handleLoadingChange}
            selectedCharacter={explorer.characterVariant}
            selectedLevel={selectedLevel}
          />
        </Suspense>
      </Canvas>

      <ExpeditionHUD
        expedition={expedition}
        score={score}
        startedAt={startedAt}
        crew={crew}
        controlsRef={controlsRef}
        onEndExpedition={handleEndExpedition}
        onLeave={handleLeave}
      />

      {/* Level Loading Overlay */}
      {isLevelLoading && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-ground" role="status">
          <span className="tm-eyebrow text-gold">Preparing expedition…</span>
        </div>
      )}
    </div>
  );
};

const ResultsRoute: React.FC = () => {
  const { lastRun } = useGameContext();
  const navigate = useNavigate();

  if (!lastRun) return <Navigate to="/" replace />;

  return (
    <ResultsScreen
      run={lastRun}
      onBaseCamp={() => navigate('/')}
      onNextExpedition={() => navigate('/level-select')}
    />
  );
};

// Game Provider Component
const GameProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [explorerId, setExplorerId] = useState<ExplorerRoleId>(DEFAULT_EXPLORER);
  const [selectedLevel, setSelectedLevel] = useState<Level>('overworld');
  const [playerName, setPlayerName] = useState(readSavedName);
  const [score, setScore] = useState(0);
  const [lastRun, setLastRun] = useState<ExpeditionRun | null>(null);
  const { isConnected, updateCharacter } = useMultiplayer();

  const controlsRef = useRef<Controls>({
    up: false,
    down: false,
    left: false,
    right: false,
    attack: false,
  });

  // Keep the crew's view of this explorer current when the role changes mid-lobby.
  useEffect(() => {
    if (isConnected) updateCharacter(getExplorerRole(explorerId).characterVariant);
  }, [explorerId, isConnected, updateCharacter]);

  const contextValue: GameContextType = {
    explorerId,
    setExplorerId,
    selectedLevel,
    setSelectedLevel,
    playerName,
    setPlayerName,
    score,
    setScore,
    controlsRef,
    lastRun,
    setLastRun,
  };

  return (
    <GameContext.Provider value={contextValue}>
      {children}
    </GameContext.Provider>
  );
};

// Main App Component with Routing
const AppContent: React.FC = () => {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<TitleScreen />} />
        <Route path="/about" element={<LandingPage />} />
        <Route path="/build" element={<AboutPage />} />
        <Route path="/character-select" element={<CharacterSelectRoute />} />
        <Route path="/level-select" element={<LevelSelectRoute />} />
        <Route path="/lobby" element={<LobbyRoute />} />
        <Route path="/game" element={<GameRoute />} />
        <Route path="/results" element={<ResultsRoute />} />
        {/* Redirect any unknown routes to home */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
};

// Main App component with routing and providers
const App: React.FC = () => {
  return (
    <MultiplayerProvider>
      <GameProvider>
        <AppContent />
      </GameProvider>
    </MultiplayerProvider>
  );
};

export default App;
