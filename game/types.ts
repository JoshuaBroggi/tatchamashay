
import * as THREE from 'three';

export type Controls = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
};

export type Level = 'overworld' | 'cave';

// Character variants - different characters and cloak colors
export type CharacterVariant = 'purple' | 'black' | 'fluffy';

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
  },
  {
    id: 'fluffy',
    name: 'Fluffy',
    cloakColor: '#FFFFFF', // Not used for Fluffy
    description: 'A magical unicorn with a pointy horn'
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
