import React, { createContext, useContext, useCallback, useRef, useState, useEffect } from 'react';
import { CharacterVariant, Level } from '../types';
import {
  MultiplayerContextValue,
  RemotePlayer,
  InterpolatedPlayer,
  ServerMessage,
  generateRoomCode,
  generatePlayerId,
} from './types';

// PartyKit host - use environment variable or default to localhost for development
const PARTYKIT_HOST = import.meta.env.VITE_PARTYKIT_HOST || 'localhost:1999';

// Multiplayer requires running: npm install
// After install, set this to true to enable multiplayer
const MULTIPLAYER_AVAILABLE = false;

// Type for PartySocket when multiplayer is disabled
type PartySocketType = any;

// Stub function - returns null until npm install is run
const getPartySocket = async (): Promise<PartySocketType | null> => {
  if (!MULTIPLAYER_AVAILABLE) {
    console.warn('Multiplayer not available. Run "npm install" to enable multiplayer features.');
    return null;
  }
  // This will only be reached after npm install and setting MULTIPLAYER_AVAILABLE = true
  return null;
};

const defaultContextValue: MultiplayerContextValue = {
  isConnected: false,
  isConnecting: false,
  roomCode: null,
  playerId: null,
  isHost: false,
  remotePlayers: new Map(),
  playerCount: 0,
  gameStarted: false,
  createRoom: async () => '',
  joinRoom: async () => {},
  leaveRoom: () => {},
  startGame: () => {},
  broadcastPosition: () => {},
  broadcastAttack: () => {},
  broadcastBalloonPop: () => {},
  broadcastGemCollect: () => {},
  broadcastLevelChange: () => {},
  updateCharacter: () => {},
};

const MultiplayerContext = createContext<MultiplayerContextValue>(defaultContextValue);

export const useMultiplayer = () => useContext(MultiplayerContext);

interface MultiplayerProviderProps {
  children: React.ReactNode;
}

export const MultiplayerProvider: React.FC<MultiplayerProviderProps> = ({ children }) => {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [roomCode, setRoomCode] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [hostId, setHostId] = useState<string | null>(null);
  const [remotePlayers, setRemotePlayers] = useState<Map<string, InterpolatedPlayer>>(new Map());
  const [gameStarted, setGameStarted] = useState(false);

  const socketRef = useRef<PartySocketType | null>(null);
  const playerIdRef = useRef<string | null>(null);
  const lastPositionBroadcast = useRef<number>(0);
  
  // Position broadcast throttle (50ms = 20Hz)
  const POSITION_BROADCAST_INTERVAL = 50;

  // Clean up connection on unmount
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    try {
      const data = JSON.parse(event.data) as ServerMessage;

      switch (data.type) {
        case 'player_list':
          handlePlayerList(data.players, data.hostId);
          break;

        case 'sync_state':
          handleSyncState(data.state);
          break;

        case 'position':
          handleRemotePosition(data);
          break;

        case 'attack':
          handleRemoteAttack(data.playerId, true);
          break;

        case 'attack_end':
          handleRemoteAttack(data.playerId, false);
          break;

        case 'leave':
          handlePlayerLeave(data.playerId);
          break;

        case 'game_start':
          setGameStarted(true);
          break;

        case 'balloon_pop':
          // Handle in game components via subscription
          window.dispatchEvent(new CustomEvent('mp:balloon_pop', { detail: data }));
          break;

        case 'gem_collect':
          // Handle in game components via subscription
          window.dispatchEvent(new CustomEvent('mp:gem_collect', { detail: data }));
          break;

        case 'level_change':
          // Handle in game components via subscription
          window.dispatchEvent(new CustomEvent('mp:level_change', { detail: data }));
          break;

        case 'error':
          console.error('Server error:', data.message);
          break;
      }
    } catch (e) {
      console.error('Failed to parse message:', e);
    }
  }, []);

  const handlePlayerList = useCallback((players: RemotePlayer[], newHostId: string) => {
    setHostId(newHostId);
    
    setRemotePlayers(prev => {
      const newMap = new Map<string, InterpolatedPlayer>();
      
      players.forEach(player => {
        // Skip our own player
        if (player.id === playerIdRef.current) return;
        
        const existing = prev.get(player.id);
        if (existing) {
          // Update existing player, preserve interpolation state
          newMap.set(player.id, {
            ...existing,
            ...player,
            targetPosition: player.position,
            targetRotation: player.rotation,
          });
        } else {
          // New player
          newMap.set(player.id, {
            ...player,
            targetPosition: player.position,
            targetRotation: player.rotation,
            currentPosition: { ...player.position },
            currentRotation: player.rotation,
          });
        }
      });
      
      return newMap;
    });
  }, []);

  const handleSyncState = useCallback((state: { hostId: string; players: RemotePlayer[]; gameStarted: boolean }) => {
    setHostId(state.hostId);
    setGameStarted(state.gameStarted);
    handlePlayerList(state.players, state.hostId);
  }, [handlePlayerList]);

  const handleRemotePosition = useCallback((data: { playerId: string; x: number; y: number; z: number; rotation: number }) => {
    // Skip our own position updates
    if (data.playerId === playerIdRef.current) return;

    setRemotePlayers(prev => {
      const player = prev.get(data.playerId);
      if (!player) return prev;

      const newMap = new Map(prev);
      newMap.set(data.playerId, {
        ...player,
        targetPosition: { x: data.x, y: data.y, z: data.z },
        targetRotation: data.rotation,
        position: { x: data.x, y: data.y, z: data.z },
        rotation: data.rotation,
      });
      return newMap;
    });
  }, []);

  const handleRemoteAttack = useCallback((remotePlayerId: string, isAttacking: boolean) => {
    if (remotePlayerId === playerIdRef.current) return;

    setRemotePlayers(prev => {
      const player = prev.get(remotePlayerId);
      if (!player) return prev;

      const newMap = new Map(prev);
      newMap.set(remotePlayerId, {
        ...player,
        isAttacking,
      });
      return newMap;
    });
  }, []);

  const handlePlayerLeave = useCallback((leavingPlayerId: string) => {
    setRemotePlayers(prev => {
      const newMap = new Map(prev);
      newMap.delete(leavingPlayerId);
      return newMap;
    });
  }, []);

  const createRoom = useCallback(async (playerName: string, characterVariant: CharacterVariant): Promise<string> => {
    const PartySocket = await getPartySocket();
    if (!PartySocket) {
      throw new Error('Multiplayer not available. Please run npm install to enable.');
    }
    
    setIsConnecting(true);
    
    const code = generateRoomCode();
    const id = generatePlayerId();
    
    playerIdRef.current = id;
    setPlayerId(id);
    setRoomCode(code);

    return new Promise((resolve, reject) => {
      try {
        const socket = new PartySocket({
          host: PARTYKIT_HOST,
          room: code,
        });

        socket.addEventListener('open', () => {
          setIsConnected(true);
          setIsConnecting(false);
          
          // Send join message
          socket.send(JSON.stringify({
            type: 'join',
            playerId: id,
            name: playerName,
            characterVariant,
          }));
          
          resolve(code);
        });

        socket.addEventListener('message', handleMessage);

        socket.addEventListener('close', () => {
          setIsConnected(false);
          setRoomCode(null);
          setRemotePlayers(new Map());
          setGameStarted(false);
        });

        socket.addEventListener('error', (error: any) => {
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          reject(error);
        });

        socketRef.current = socket;
      } catch (error) {
        setIsConnecting(false);
        reject(error);
      }
    });
  }, [handleMessage]);

  const joinRoom = useCallback(async (code: string, playerName: string, characterVariant: CharacterVariant): Promise<void> => {
    const PartySocket = await getPartySocket();
    if (!PartySocket) {
      throw new Error('Multiplayer not available. Please run npm install to enable.');
    }
    
    setIsConnecting(true);
    
    const id = generatePlayerId();
    playerIdRef.current = id;
    setPlayerId(id);
    setRoomCode(code.toUpperCase());

    return new Promise((resolve, reject) => {
      try {
        const socket = new PartySocket({
          host: PARTYKIT_HOST,
          room: code.toUpperCase(),
        });

        socket.addEventListener('open', () => {
          setIsConnected(true);
          setIsConnecting(false);
          
          // Send join message
          socket.send(JSON.stringify({
            type: 'join',
            playerId: id,
            name: playerName,
            characterVariant,
          }));
          
          resolve();
        });

        socket.addEventListener('message', handleMessage);

        socket.addEventListener('close', () => {
          setIsConnected(false);
          setRoomCode(null);
          setRemotePlayers(new Map());
          setGameStarted(false);
        });

        socket.addEventListener('error', (error: any) => {
          console.error('WebSocket error:', error);
          setIsConnecting(false);
          reject(error);
        });

        socketRef.current = socket;
      } catch (error) {
        setIsConnecting(false);
        reject(error);
      }
    });
  }, [handleMessage]);

  const leaveRoom = useCallback(() => {
    if (socketRef.current && playerId) {
      socketRef.current.send(JSON.stringify({
        type: 'leave',
        playerId,
      }));
      socketRef.current.close();
    }
    
    socketRef.current = null;
    setIsConnected(false);
    setRoomCode(null);
    setPlayerId(null);
    playerIdRef.current = null;
    setHostId(null);
    setRemotePlayers(new Map());
    setGameStarted(false);
  }, [playerId]);

  const startGame = useCallback(() => {
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({ type: 'game_start' }));
    }
  }, []);

  const broadcastPosition = useCallback((x: number, y: number, z: number, rotation: number) => {
    const now = Date.now();
    if (now - lastPositionBroadcast.current < POSITION_BROADCAST_INTERVAL) {
      return;
    }
    lastPositionBroadcast.current = now;

    if (socketRef.current && playerId) {
      socketRef.current.send(JSON.stringify({
        type: 'position',
        playerId,
        x,
        y,
        z,
        rotation,
      }));
    }
  }, [playerId]);

  const broadcastAttack = useCallback((isAttacking: boolean) => {
    if (socketRef.current && playerId) {
      socketRef.current.send(JSON.stringify({
        type: isAttacking ? 'attack' : 'attack_end',
        playerId,
      }));
    }
  }, [playerId]);

  const broadcastBalloonPop = useCallback((balloonIds: string[]) => {
    if (socketRef.current && playerId) {
      socketRef.current.send(JSON.stringify({
        type: 'balloon_pop',
        balloonIds,
        poppedBy: playerId,
      }));
    }
  }, [playerId]);

  const broadcastGemCollect = useCallback((gemId: string) => {
    if (socketRef.current && playerId) {
      socketRef.current.send(JSON.stringify({
        type: 'gem_collect',
        gemId,
        collectedBy: playerId,
      }));
    }
  }, [playerId]);

  const broadcastLevelChange = useCallback((level: Level) => {
    if (socketRef.current) {
      socketRef.current.send(JSON.stringify({
        type: 'level_change',
        level,
      }));
    }
  }, []);

  const updateCharacter = useCallback((characterVariant: CharacterVariant) => {
    if (socketRef.current && playerId) {
      socketRef.current.send(JSON.stringify({
        type: 'character_update',
        playerId,
        characterVariant,
      }));
    }
  }, [playerId]);

  const isHost = playerId !== null && playerId === hostId;
  const playerCount = remotePlayers.size + (playerId ? 1 : 0);

  const value: MultiplayerContextValue = {
    isConnected,
    isConnecting,
    roomCode,
    playerId,
    isHost,
    remotePlayers,
    playerCount,
    gameStarted,
    createRoom,
    joinRoom,
    leaveRoom,
    startGame,
    broadcastPosition,
    broadcastAttack,
    broadcastBalloonPop,
    broadcastGemCollect,
    broadcastLevelChange,
    updateCharacter,
  };

  return (
    <MultiplayerContext.Provider value={value}>
      {children}
    </MultiplayerContext.Provider>
  );
};

export default MultiplayerContext;
