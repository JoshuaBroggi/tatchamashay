
import * as THREE from 'three';

export type Controls = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
};

export type Level = 'overworld';

// Character variants - different characters and cloak colors
export type CharacterVariant = 'black' | 'fluffy';

export interface CharacterConfig {
  id: CharacterVariant;
  name: string;
  cloakColor: string;
  description: string;
}

export const CHARACTER_CONFIGS: CharacterConfig[] = [
  {
    id: 'black',
    name: 'Death Vader',
    cloakColor: '#0F0F0F', // True black
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
  onLoadingChange?: (isLoading: boolean) => void;
  selectedCharacter?: CharacterVariant;
  selectedLevel?: Level;
};
