/**
 * Quality tier system for performance scaling.
 * Routes shadow settings, object density, LOD distances, and update frequency
 * through a global quality configuration.
 */

export type QualityTier = 'low' | 'medium' | 'high';

export interface QualitySettings {
  /** Shadow map size for the primary directional light */
  shadowMapSize: number;
  /** Whether shadows are enabled at all */
  shadowsEnabled: boolean;
  /** Whether decorative meshes cast shadows */
  decorativeShadows: boolean;
  /** Multiplier for object density (grass blades, balloons, etc.) */
  densityMultiplier: number;
  /** Max balloon count */
  maxBalloons: number;
  /** Max grass patches */
  maxGrassPatches: number;
  /** Balloon sphere geometry segments */
  balloonSegments: number;
  /** Mountain geometry radial segments */
  mountainSegments: number;
  /** Floor plane segments for tessellation */
  floorSegments: number;
  /** Shadow camera frustum size */
  shadowFrustum: number;
  /** Max update distance for dynamic objects (beyond this, skip updates) */
  dynamicUpdateDistance: number;
  /** Update frequency divisor for far objects (1 = every frame, 2 = every other, etc.) */
  farObjectUpdateDivisor: number;
  /** Far distance threshold (objects beyond this use reduced update rate) */
  farDistanceThreshold: number;
  /** Whether to use Environment preset (HDR) */
  useEnvironmentMap: boolean;
  /** DPR range */
  dprRange: [number, number];
  /** Max point lights per scene */
  maxPointLights: number;
  /** Texture anisotropy level */
  anisotropy: number;
}

const LOW_QUALITY: QualitySettings = {
  shadowMapSize: 512,
  shadowsEnabled: true,
  decorativeShadows: false,
  densityMultiplier: 0.5,
  maxBalloons: 400,
  maxGrassPatches: 30,
  balloonSegments: 8,
  mountainSegments: 8,
  floorSegments: 4,
  shadowFrustum: 80,
  dynamicUpdateDistance: 60,
  farObjectUpdateDivisor: 3,
  farDistanceThreshold: 30,
  useEnvironmentMap: false,
  dprRange: [1, 1],
  maxPointLights: 4,
  anisotropy: 1,
};

const MEDIUM_QUALITY: QualitySettings = {
  shadowMapSize: 1024,
  shadowsEnabled: true,
  decorativeShadows: true,
  densityMultiplier: 0.75,
  maxBalloons: 600,
  maxGrassPatches: 50,
  balloonSegments: 10,
  mountainSegments: 10,
  floorSegments: 16,
  shadowFrustum: 100,
  dynamicUpdateDistance: 80,
  farObjectUpdateDivisor: 2,
  farDistanceThreshold: 40,
  useEnvironmentMap: true,
  dprRange: [1, 1.5],
  maxPointLights: 8,
  anisotropy: 4,
};

const HIGH_QUALITY: QualitySettings = {
  shadowMapSize: 2048,
  shadowsEnabled: true,
  decorativeShadows: true,
  densityMultiplier: 1.0,
  maxBalloons: 800,
  maxGrassPatches: 72,
  balloonSegments: 12,
  mountainSegments: 12,
  floorSegments: 32,
  shadowFrustum: 120,
  dynamicUpdateDistance: 120,
  farObjectUpdateDivisor: 1,
  farDistanceThreshold: 50,
  useEnvironmentMap: true,
  dprRange: [1, 2],
  maxPointLights: 16,
  anisotropy: 8,
};

const QUALITY_PRESETS: Record<QualityTier, QualitySettings> = {
  low: LOW_QUALITY,
  medium: MEDIUM_QUALITY,
  high: HIGH_QUALITY,
};

/** Global mutable quality state */
let currentTier: QualityTier = 'medium';
let currentSettings: QualitySettings = { ...MEDIUM_QUALITY };

/**
 * Detect a reasonable default quality tier based on device capabilities.
 * Called once at startup.
 */
export function detectQualityTier(): QualityTier {
  if (typeof navigator === 'undefined') return 'medium';

  const cores = navigator.hardwareConcurrency || 4;
  const memory = (navigator as any).deviceMemory || 4; // GB, Chrome-only
  const isMobile = /Mobi|Android|iPhone|iPad/i.test(navigator.userAgent);

  if (isMobile || cores <= 2 || memory <= 2) return 'low';
  if (cores >= 8 && memory >= 8) return 'high';
  return 'medium';
}

export function setQualityTier(tier: QualityTier): void {
  currentTier = tier;
  currentSettings = { ...QUALITY_PRESETS[tier] };
}

export function getQualityTier(): QualityTier {
  return currentTier;
}

export function getQualitySettings(): QualitySettings {
  return currentSettings;
}

// Auto-detect on module load
setQualityTier(detectQualityTier());
