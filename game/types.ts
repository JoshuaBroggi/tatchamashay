
import * as THREE from 'three';

export type Controls = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
};

export type Level = 'overworld' | 'cave';

// Character variants - different cloak colors for Darth Vader
export type CharacterVariant = 'purple' | 'black';

export interface CharacterConfig {
  id: CharacterVariant;
  name: string;
  cloakColor: string;
  description: string;
}

export const CHARACTER_CONFIGS: CharacterConfig[] = [
  {
    id: 'purple',
    name: 'Imperial Mystic',
    cloakColor: '#6B21A8', // Purple-800
    description: 'A Sith Lord shrouded in arcane mystery'
  },
  {
    id: 'black',
    name: 'Dark Lord',
    cloakColor: '#1a1a1a', // Near black
    description: 'The classic fearsome Sith warrior'
  }
];

export type GameProps = {
  isPlaying: boolean;
  controlsRef: React.MutableRefObject<Controls>;
  onScoreUpdate: (cb: (prev: number) => number) => void;
  onLevelChange?: (level: Level) => void;
  onGemsChange?: (count: number) => void;
  onLoadingChange?: (isLoading: boolean) => void;
  selectedCharacter?: CharacterVariant;
};
