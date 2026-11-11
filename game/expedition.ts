import { CharacterVariant, Level } from './types';

// 2.0 explorer roles and expeditions (docs/design/2.0/screens). Names and copy are placeholders
// from the mockups. Each role and expedition still runs on a 1.x model or level underneath.

export type ExplorerRoleId = 'scout' | 'climber' | 'cartographer' | 'diver' | 'engineer' | 'medic';

export interface ExplorerRole {
  id: ExplorerRoleId;
  role: string;
  name: string;
  perk: string;
  stats: { speed: number; climb: number; insight: number };
  /** 1.x model shown for this role until 2.0 explorer models exist. */
  characterVariant: CharacterVariant;
}

export const EXPLORER_ROLES: ExplorerRole[] = [
  { id: 'scout', role: 'Scout', name: 'Ren Okafor', perk: 'Spots hidden relics from farther away.', stats: { speed: 80, climb: 50, insight: 60 }, characterVariant: 'fluffy' },
  { id: 'climber', role: 'Climber', name: 'Mara Voss', perk: 'Scales cliffs and temple walls others can’t.', stats: { speed: 60, climb: 90, insight: 50 }, characterVariant: 'tarantula' },
  { id: 'cartographer', role: 'Cartographer', name: 'Theo Lind', perk: 'Reveals the map and secret passages for the crew.', stats: { speed: 50, climb: 40, insight: 95 }, characterVariant: 'trex' },
  { id: 'diver', role: 'Diver', name: 'Isla Reyes', perk: 'Holds breath longer in flooded caves.', stats: { speed: 70, climb: 70, insight: 60 }, characterVariant: 'lobster' },
  { id: 'engineer', role: 'Engineer', name: 'Kai Brandt', perk: 'Disarms traps and opens sealed doors faster.', stats: { speed: 55, climb: 60, insight: 80 }, characterVariant: 'scorpion' },
  { id: 'medic', role: 'Medic', name: 'Noor Haddad', perk: 'Revives fallen crew and cures snake bites.', stats: { speed: 65, climb: 50, insight: 70 }, characterVariant: 'spittingCobra' },
];

export const DEFAULT_EXPLORER: ExplorerRoleId = 'cartographer';

export const getExplorerRole = (id: ExplorerRoleId): ExplorerRole =>
  EXPLORER_ROLES.find(r => r.id === id) ?? EXPLORER_ROLES[0];

/** Role for a crew member's synced model; null for models no 2.0 role uses. */
export const roleForCharacter = (variant: CharacterVariant | string): ExplorerRole | null =>
  EXPLORER_ROLES.find(r => r.characterVariant === variant) ?? null;

export interface Expedition {
  level: Level;
  region: string;
  name: string;
  description: string;
  objective: string;
  relics: number;
  /** Danger out of 3. */
  danger: 1 | 2 | 3;
  /** Placeholder scene art for the expedition card until real key art exists. */
  sceneGradient: string;
}

export const EXPEDITIONS: Expedition[] = [
  {
    level: 'overworld',
    region: 'Andes · Cloud forest',
    name: 'The Sunken Temple',
    description: 'Flooded stone halls under a mountain monastery. Find the jade idol before the water rises.',
    objective: 'Find the jade idol',
    relics: 6,
    danger: 2,
    sceneGradient: 'linear-gradient(#5F7A6A, #2E3B33 60%, #1A221D)',
  },
  {
    level: 'desert',
    region: 'Sahara · Dune sea',
    name: 'Tomb of the Salt King',
    description: 'Sand-buried tomb with pressure-plate traps and scorpion nests.',
    objective: 'Reach the salt king’s chamber',
    relics: 8,
    danger: 3,
    sceneGradient: 'linear-gradient(#C99A5B, #8A5F2E 60%, #3B2814)',
  },
  {
    level: 'jurassicPark',
    region: 'Borneo · Rainforest',
    name: 'The Lost Observatory',
    description: 'A vine-choked tower hiding a golden star map. Watch for vipers.',
    objective: 'Recover the golden star map',
    relics: 5,
    danger: 1,
    sceneGradient: 'linear-gradient(#4E6B3A, #26361C 60%, #121A0D)',
  },
];

export const getExpedition = (level: Level): Expedition =>
  EXPEDITIONS.find(e => e.level === level) ?? EXPEDITIONS[0];

export const dangerMeter = (danger: number): string => '▮'.repeat(danger) + '▯'.repeat(3 - danger);

export const formatScore = (n: number): string => n.toLocaleString('en-US');

export const formatDuration = (ms: number): string => {
  const total = Math.max(0, Math.round(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
};
