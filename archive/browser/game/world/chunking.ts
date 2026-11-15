/**
 * Deterministic chunk-based world generation.
 *
 * Instead of syncing every decorative object over the network,
 * clients generate identical decor from a shared seed + version.
 * Only gameplay-critical state (player positions, scores, collected items)
 * is synced through the multiplayer system.
 *
 * Chunk lifecycle: cold -> warm -> active -> warm -> cold
 * - cold:   not loaded, no resources allocated
 * - warm:   geometry generated, not yet added to scene
 * - active: visible and updated each frame
 */

// --- Seeded PRNG (same as used in level components) ---
export const seededRandom = (seed: number): number => {
  const x = Math.sin(seed * 12.9898) * 43758.5453;
  return x - Math.floor(x);
};

// --- Chunk descriptor ---
export interface ChunkDescriptor {
  /** Grid X index */
  cx: number;
  /** Grid Z index */
  cz: number;
  /** World-space center X */
  worldX: number;
  /** World-space center Z */
  worldZ: number;
  /** Deterministic seed for this chunk */
  seed: number;
  /** Current lifecycle state */
  state: 'cold' | 'warm' | 'active';
}

export interface ChunkGridConfig {
  /** Size of each chunk in world units */
  chunkSize: number;
  /** Number of chunks along each axis (total chunks = gridSize^2) */
  gridSize: number;
  /** Activation radius in chunks around the player */
  activeRadius: number;
  /** Warm radius (pre-load) in chunks around the player */
  warmRadius: number;
  /** Base seed for the entire level */
  levelSeed: number;
  /** Level version for compatibility checking */
  levelVersion: number;
}

const DEFAULT_CONFIG: ChunkGridConfig = {
  chunkSize: 20,
  gridSize: 6,
  activeRadius: 2,
  warmRadius: 3,
  levelSeed: 42,
  levelVersion: 1,
};

/**
 * Generate a deterministic seed for a chunk from its grid position and level seed.
 */
export function chunkSeed(cx: number, cz: number, levelSeed: number): number {
  // Use a hash-like combination that avoids patterns
  return Math.abs(
    ((cx * 73856093) ^ (cz * 19349663) ^ (levelSeed * 83492791)) % 2147483647
  );
}

/**
 * Create the full chunk grid for a level.
 */
export function createChunkGrid(config: Partial<ChunkGridConfig> = {}): ChunkDescriptor[] {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const chunks: ChunkDescriptor[] = [];
  const halfGrid = Math.floor(cfg.gridSize / 2);

  for (let cx = -halfGrid; cx < halfGrid; cx++) {
    for (let cz = -halfGrid; cz < halfGrid; cz++) {
      chunks.push({
        cx,
        cz,
        worldX: cx * cfg.chunkSize + cfg.chunkSize / 2,
        worldZ: cz * cfg.chunkSize + cfg.chunkSize / 2,
        seed: chunkSeed(cx, cz, cfg.levelSeed),
        state: 'cold',
      });
    }
  }

  return chunks;
}

/**
 * Update chunk states based on player position.
 * Returns lists of chunks that changed state for the caller to act on.
 */
export function updateChunkStates(
  chunks: ChunkDescriptor[],
  playerX: number,
  playerZ: number,
  config: Partial<ChunkGridConfig> = {}
): { activated: ChunkDescriptor[]; deactivated: ChunkDescriptor[]; warmed: ChunkDescriptor[] } {
  const cfg = { ...DEFAULT_CONFIG, ...config };
  const activated: ChunkDescriptor[] = [];
  const deactivated: ChunkDescriptor[] = [];
  const warmed: ChunkDescriptor[] = [];

  // Determine which grid cell the player is in
  const playerCX = Math.floor(playerX / cfg.chunkSize);
  const playerCZ = Math.floor(playerZ / cfg.chunkSize);

  for (const chunk of chunks) {
    const dx = Math.abs(chunk.cx - playerCX);
    const dz = Math.abs(chunk.cz - playerCZ);
    const chebDist = Math.max(dx, dz);

    const prevState = chunk.state;

    if (chebDist <= cfg.activeRadius) {
      chunk.state = 'active';
      if (prevState !== 'active') activated.push(chunk);
    } else if (chebDist <= cfg.warmRadius) {
      chunk.state = 'warm';
      if (prevState === 'cold') warmed.push(chunk);
      if (prevState === 'active') deactivated.push(chunk);
    } else {
      chunk.state = 'cold';
      if (prevState === 'active') deactivated.push(chunk);
    }
  }

  return { activated, deactivated, warmed };
}

/**
 * Generate decorative object placements for a single chunk.
 * All clients calling this with the same seed produce identical results.
 */
export interface DecorPlacement {
  x: number;
  y: number;
  z: number;
  rotationY: number;
  scale: number;
  type: string; // e.g. 'grass', 'flower', 'rock'
}

export function generateChunkDecor(
  chunk: ChunkDescriptor,
  chunkSize: number,
  density: number
): DecorPlacement[] {
  const placements: DecorPlacement[] = [];
  const count = Math.floor(density * chunkSize * chunkSize * 0.01);

  for (let i = 0; i < count; i++) {
    const s = chunk.seed + i * 7;
    const localX = (seededRandom(s) - 0.5) * chunkSize;
    const localZ = (seededRandom(s + 1) - 0.5) * chunkSize;

    placements.push({
      x: chunk.worldX + localX,
      y: 0,
      z: chunk.worldZ + localZ,
      rotationY: seededRandom(s + 2) * Math.PI * 2,
      scale: 0.7 + seededRandom(s + 3) * 0.6,
      type: seededRandom(s + 4) < 0.7 ? 'grass' : 'flower',
    });
  }

  return placements;
}
