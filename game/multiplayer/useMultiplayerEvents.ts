import { useEffect, useCallback } from 'react';
import { Level } from '../types';

// Custom event types
interface BalloonPopEvent {
  balloonIds: string[];
  poppedBy: string;
}

interface GemCollectEvent {
  gemId: string;
  collectedBy: string;
}

interface LevelChangeEvent {
  level: Level;
}

/**
 * Hook to subscribe to multiplayer game events
 * These events are dispatched from the MultiplayerContext when messages are received
 */
export function useMultiplayerEvents(handlers: {
  onBalloonPop?: (event: BalloonPopEvent) => void;
  onGemCollect?: (event: GemCollectEvent) => void;
  onLevelChange?: (event: LevelChangeEvent) => void;
}) {
  const { onBalloonPop, onGemCollect, onLevelChange } = handlers;

  useEffect(() => {
    const handleBalloonPop = (e: Event) => {
      const customEvent = e as CustomEvent<BalloonPopEvent>;
      onBalloonPop?.(customEvent.detail);
    };

    const handleGemCollect = (e: Event) => {
      const customEvent = e as CustomEvent<GemCollectEvent>;
      onGemCollect?.(customEvent.detail);
    };

    const handleLevelChange = (e: Event) => {
      const customEvent = e as CustomEvent<LevelChangeEvent>;
      onLevelChange?.(customEvent.detail);
    };

    if (onBalloonPop) {
      window.addEventListener('mp:balloon_pop', handleBalloonPop);
    }
    if (onGemCollect) {
      window.addEventListener('mp:gem_collect', handleGemCollect);
    }
    if (onLevelChange) {
      window.addEventListener('mp:level_change', handleLevelChange);
    }

    return () => {
      window.removeEventListener('mp:balloon_pop', handleBalloonPop);
      window.removeEventListener('mp:gem_collect', handleGemCollect);
      window.removeEventListener('mp:level_change', handleLevelChange);
    };
  }, [onBalloonPop, onGemCollect, onLevelChange]);
}

export default useMultiplayerEvents;
