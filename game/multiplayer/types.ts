import { CharacterVariant, Level } from '../types';

// Remote player data synced across network
export interface RemotePlayer {
  id: string;
  name: string;
  characterVariant: CharacterVariant;
  position: { x: number; y: number; z: number };
  rotation: number;
  isAttacking: boolean;
  isReady: boolean;
}

// Interpolated player state for smooth rendering
export interface InterpolatedPlayer extends RemotePlayer {
  targetPosition: { x: number; y: number; z: number };
  targetRotation: number;
  currentPosition: { x: number; y: number; z: number };
  currentRotation: number;
}

// Full game sync state
export interface GameSyncState {
  hostId: string;
  players: RemotePlayer[];
  currentLevel: Level;
  gameStarted: boolean;
  poppedBalloons: string[];
  collectedGems: string[];
}

// Message types sent between clients and server
export type ClientMessage =
  | { type: 'join'; playerId: string; name: string; characterVariant: string }
  | { type: 'leave'; playerId: string }
  | { type: 'position'; playerId: string; x: number; y: number; z: number; rotation: number }
  | { type: 'attack'; playerId: string }
  | { type: 'attack_end'; playerId: string }
  | { type: 'balloon_pop'; balloonIds: string[]; poppedBy: string }
  | { type: 'gem_collect'; gemId: string; collectedBy: string }
  | { type: 'level_change'; level: Level }
  | { type: 'game_start' }
  | { type: 'character_update'; playerId: string; characterVariant: string };

export type ServerMessage =
  | { type: 'player_list'; players: RemotePlayer[]; hostId: string }
  | { type: 'sync_state'; state: GameSyncState }
  | { type: 'position'; playerId: string; x: number; y: number; z: number; rotation: number }
  | { type: 'attack'; playerId: string }
  | { type: 'attack_end'; playerId: string }
  | { type: 'balloon_pop'; balloonIds: string[]; poppedBy: string }
  | { type: 'gem_collect'; gemId: string; collectedBy: string }
  | { type: 'level_change'; level: Level }
  | { type: 'leave'; playerId: string }
  | { type: 'game_start' }
  | { type: 'error'; message: string };

// Multiplayer context value
export interface MultiplayerContextValue {
  // Connection state
  isConnected: boolean;
  isConnecting: boolean;
  roomCode: string | null;
  playerId: string | null;
  
  // Player info
  isHost: boolean;
  remotePlayers: Map<string, InterpolatedPlayer>;
  playerCount: number;
  
  // Game state
  gameStarted: boolean;
  
  // Actions
  createRoom: (playerName: string, characterVariant: CharacterVariant) => Promise<string>;
  joinRoom: (roomCode: string, playerName: string, characterVariant: CharacterVariant) => Promise<void>;
  leaveRoom: () => void;
  startGame: () => void;
  
  // Sync methods
  broadcastPosition: (x: number, y: number, z: number, rotation: number) => void;
  broadcastAttack: (isAttacking: boolean) => void;
  broadcastBalloonPop: (balloonIds: string[]) => void;
  broadcastGemCollect: (gemId: string) => void;
  broadcastLevelChange: (level: Level) => void;
  updateCharacter: (characterVariant: CharacterVariant) => void;
}

// Room info for lobby display
export interface RoomInfo {
  code: string;
  playerCount: number;
  maxPlayers: number;
  hostName: string;
}

// Generate a random 4-character room code
export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing characters
  let code = '';
  for (let i = 0; i < 4; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

// Generate a random player ID
export function generatePlayerId(): string {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}
