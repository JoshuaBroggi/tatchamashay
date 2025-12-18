// Multiplayer module exports
export { MultiplayerProvider, useMultiplayer } from './MultiplayerContext';
export { useMultiplayerEvents } from './useMultiplayerEvents';
export type {
  RemotePlayer,
  InterpolatedPlayer,
  GameSyncState,
  MultiplayerContextValue,
  ClientMessage,
  ServerMessage,
} from './types';
export { generateRoomCode, generatePlayerId } from './types';

