
import * as THREE from 'three';

export type Controls = {
  up: boolean;
  down: boolean;
  left: boolean;
  right: boolean;
  attack: boolean;
};

export type Level = 'overworld' | 'desert' | 'jurassicPark';

// Level configuration
export interface LevelConfig {
  id: Level;
  name: string;
  description: string;
}

export const LEVEL_CONFIGS: LevelConfig[] = [
  {
    id: 'overworld',
    name: 'Sunny Balloon World',
    description: 'Pop colorful balloons in a bright, sunny world!'
  },
  {
    id: 'desert',
    name: 'Scorched Sands',
    description: 'A blazing desert crawling with cobras, scorpions, and hardy cacti.'
  },
  {
    id: 'jurassicPark',
    name: 'Jurassic Park',
    description: 'Survive a prehistoric jungle prowled by a ferocious T-Rex!'
  }
];

// Character variants - different characters and cloak colors
export type CharacterVariant =
  | 'black'
  | 'fluffy'
  | 'lobster'
  | 'trex'
  | 'mosasaurus'
  | 'legoMosasaurus'
  | 'tarantula'
  | 'scorpion'
  | 'blackScorpion'
  | 'spittingCobra';

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
  },
  {
    id: 'lobster',
    name: 'Super Lobster',
    cloakColor: '#DC2626', // Not used for Lobster
    description: 'A fearsome pirate lobster from the deep seas'
  },
  {
    id: 'trex',
    name: 'Rigged T-Rex Fabulous',
    cloakColor: '#4B5563', // Not used for T-Rex
    description: 'A roaring prehistoric powerhouse with a fabulous strut'
  },
  {
    id: 'mosasaurus',
    name: 'Mosasaurus',
    cloakColor: '#0F766E', // Not used for Mosasaurus
    description: 'A giant ocean reptile from the ancient seas'
  },
  {
    id: 'legoMosasaurus',
    name: 'Lego Mosasaurus',
    cloakColor: '#1D4ED8', // Not used for Lego Mosasaurus
    description: 'A blocky, toy-inspired aquatic titan'
  },
  {
    id: 'tarantula',
    name: 'Theraphosa Blondi',
    cloakColor: '#5C4033', // Not used for Tarantula
    description: 'A giant animated tarantula with hairy legs'
  },
  {
    id: 'scorpion',
    name: 'Scorpion',
    cloakColor: '#8B6914', // Not used for Scorpion
    description: 'A deadly desert scorpion with a venomous stinger tail'
  },
  {
    id: 'blackScorpion',
    name: 'Black Scorpion',
    cloakColor: '#1A1A1A', // Not used for Black Scorpion
    description: 'A shadowy desaturated scorpion, cold as obsidian'
  },
  {
    id: 'spittingCobra',
    name: 'Spitting Cobra',
    cloakColor: '#2D5A27', // Not used for Spitting Cobra
    description: 'A venomous cobra that spits deadly venom at its prey'
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
