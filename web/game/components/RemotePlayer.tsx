import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
import { clone as skeletonClone } from 'three/examples/jsm/utils/SkeletonUtils.js';
import { CharacterVariant, CHARACTER_CONFIGS } from '../types';
import { InterpolatedPlayer } from '../multiplayer/types';

interface RemotePlayerProps {
  player: InterpolatedPlayer;
  showNameTag?: boolean;
}

/**
 * Renders a remote player's character with position interpolation
 * Uses the same model as the local player but with their selected character variant
 */
export const RemotePlayer: React.FC<RemotePlayerProps> = ({ player, showNameTag = true }) => {
  const groupRef = useRef<THREE.Group>(null);
  const swordRef = useRef<THREE.Group>(null);
  const isTarantula = player.characterVariant === 'tarantula';
  const isScorpion = player.characterVariant === 'scorpion' || player.characterVariant === 'blackScorpion';
  const isSpittingCobra = player.characterVariant === 'spittingCobra';
  const specialModelPath = useMemo(() => {
    if (player.characterVariant === 'trex') return '/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb';
    if (player.characterVariant === 'distortusRex') return '/models/distortus_rex.glb';
    if (player.characterVariant === 'tarantula') return '/models/theraphosa-blondi/source/hi-fi-spider.glb';
    if (player.characterVariant === 'scorpion' || player.characterVariant === 'blackScorpion') return '/models/scorpion.glb';
    if (player.characterVariant === 'spittingCobra') return '/models/snake_attack_animations_multiple.glb';
    return null;
  }, [player.characterVariant]);
  
  // Current interpolated position/rotation
  const currentPos = useRef(new THREE.Vector3(
    player.currentPosition.x,
    player.currentPosition.y,
    player.currentPosition.z
  ));
  const currentRot = useRef(player.currentRotation);
  
  // Target position/rotation from network updates
  const targetPos = useRef(new THREE.Vector3(
    player.targetPosition.x,
    player.targetPosition.y,
    player.targetPosition.z
  ));
  const targetRot = useRef(player.targetRotation);
  
  // Attack animation state
  const isAttacking = useRef(false);
  const attackProgress = useRef(0);
  
  // Load the character model
  const { scene } = useGLTF('/models/deathvader-optimized.glb');
  const { scene: specialScene, animations: specialAnimations } = useGLTF(specialModelPath ?? '/models/deathvader-optimized.glb');
  
  // Get cloak color from character config
  const cloakColor = useMemo(() => {
    const config = CHARACTER_CONFIGS.find(c => c.id === player.characterVariant);
    return config?.cloakColor || '#1a1a1a';
  }, [player.characterVariant]);

  // Clone and color the scene
  const clonedScene = useMemo(() => {
    if (specialModelPath) return null;
    const clone = scene.clone();
    const cloakColorObj = new THREE.Color(cloakColor);
    
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        
        const applyColorToMaterial = (mat: THREE.Material): THREE.Material => {
          const clonedMat = mat.clone();
          
          if (clonedMat instanceof THREE.MeshStandardMaterial || 
              clonedMat instanceof THREE.MeshBasicMaterial ||
              clonedMat instanceof THREE.MeshPhongMaterial ||
              clonedMat instanceof THREE.MeshLambertMaterial) {
            
            const originalColor = clonedMat.color;
            const luminance = 0.299 * originalColor.r + 0.587 * originalColor.g + 0.114 * originalColor.b;
            
            // Apply to dark materials (cloak)
            if (luminance < 0.5) {
              clonedMat.color = cloakColorObj.clone();
            }
          }
          return clonedMat;
        };
        
        if (mesh.material) {
          if (Array.isArray(mesh.material)) {
            mesh.material = mesh.material.map(applyColorToMaterial);
          } else {
            mesh.material = applyColorToMaterial(mesh.material);
          }
        }
      }
    });
    return clone;
  }, [scene, cloakColor, specialModelPath]);

  // Use SkeletonUtils.clone to preserve skin/bone bindings for rigged models
  const clonedSpecialScene = useMemo(() => {
    if (!specialModelPath) return null;
    const clone = skeletonClone(specialScene) as THREE.Group;
    clone.traverse((child) => {
      if ((child as THREE.Mesh).isMesh) {
        const mesh = child as THREE.Mesh;
        mesh.castShadow = true;
        mesh.receiveShadow = true;
        // Desaturate for black scorpion variant
        if (player.characterVariant === 'blackScorpion') {
          const desat = (mat: THREE.Material): THREE.Material => {
            const m = mat.clone();
            if (m instanceof THREE.MeshStandardMaterial) {
              m.onBeforeCompile = (shader) => {
                shader.fragmentShader = shader.fragmentShader.replace(
                  '#include <map_fragment>',
                  `#include <map_fragment>
                  float _dGray = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
                  diffuseColor.rgb = vec3(_dGray);`
                );
              };
              m.customProgramCacheKey = () => 'blackScorpion_desaturated';
            }
            return m;
          };
          if (mesh.material) {
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map(desat);
            } else {
              mesh.material = desat(mesh.material);
            }
          }
        }
      }
    });
    return clone;
  }, [specialScene, specialModelPath, player.characterVariant]);

  const specialTransform = useMemo(() => {
    if (!clonedSpecialScene) return null;
    // Force-update world matrices so SkinnedMesh bone transforms are correct
    // before computing bounding box (stale after skeletonClone).
    clonedSpecialScene.updateMatrixWorld(true);
    const box = new THREE.Box3().setFromObject(clonedSpecialScene);
    const size = new THREE.Vector3();
    const center = new THREE.Vector3();
    box.getSize(size);
    box.getCenter(center);
    const maxDimension = Math.max(size.x, size.y, size.z) || 1;
    let scale: number;
    if (player.characterVariant === 'trex' || player.characterVariant === 'distortusRex') {
      const fluffyGameHeight = 0.774 * 7.5;
      scale = fluffyGameHeight / size.y;
    } else {
      scale = 7.5 / maxDimension;
    }
    const x = -center.x * scale;
    const z = -center.z * scale;
    // Per-character facing correction
    let rotationY = -Math.PI / 2;
    if (player.characterVariant === 'tarantula') rotationY = 0;
    if (player.characterVariant === 'trex' || player.characterVariant === 'distortusRex') rotationY = 0;
    if (isScorpion) rotationY = 0;
    // Vertical offset: scorpion's Idle animation lifts the mesh above
    // the rest-pose bounding box. Empirically tuned so feet touch ground.
    let yOffset = -box.min.y * scale;
    if (isScorpion) yOffset -= 3.0;
    return {
      scale,
      x,
      y: yOffset,
      z,
      rotationY
    };
  }, [clonedSpecialScene, player.characterVariant]);

  const swimRef = useRef<THREE.Group>(null);
  const prevPos = useRef(new THREE.Vector3(
    player.currentPosition.x,
    player.currentPosition.y,
    player.currentPosition.z
  ));

  // Tarantula animation mixer for remote players (simple play/pause)
  const tarantulaMixer = useMemo(() => {
    if (!isTarantula || !clonedSpecialScene || specialAnimations.length === 0) return null;
    return new THREE.AnimationMixer(clonedSpecialScene);
  }, [isTarantula, clonedSpecialScene, specialAnimations]);

  const tarantulaAction = useRef<THREE.AnimationAction | null>(null);
  const remotePrevMoving = useRef(false);

  useEffect(() => {
    if (!tarantulaMixer || specialAnimations.length === 0) return;
    const clip = specialAnimations[0];
    if (!clip) return;
    const action = tarantulaMixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.timeScale = 1;
    action.play();
    action.paused = true;
    tarantulaAction.current = action;
    return () => {
      tarantulaMixer.stopAllAction();
      tarantulaAction.current = null;
    };
  }, [tarantulaMixer, specialAnimations]);

  // T-Rex animation mixer for remote players (walk on movement, roar burst on attack)
  const isTrex = player.characterVariant === 'trex' || player.characterVariant === 'distortusRex';
  const trexMixer = useMemo(() => {
    if (!isTrex || !clonedSpecialScene || specialAnimations.length === 0) return null;
    return new THREE.AnimationMixer(clonedSpecialScene);
  }, [isTrex, clonedSpecialScene, specialAnimations]);

  const trexAction = useRef<THREE.AnimationAction | null>(null);
  const trexPrevMoving = useRef(false);
  const trexPrevAttacking = useRef(false);
  const trexAttackingRef = useRef(false);
  const trexAttackTimer = useRef(0);
  const TREX_ATTACK_DURATION = 0.6;

  useEffect(() => {
    if (!trexMixer || specialAnimations.length === 0) return;
    const clip = specialAnimations.find(c => c.name === 'CINEMA_4D_Main') ?? specialAnimations[0];
    if (!clip) return;
    const action = trexMixer.clipAction(clip);
    action.reset();
    action.setLoop(THREE.LoopRepeat, Infinity);
    action.clampWhenFinished = false;
    action.timeScale = 1;
    action.play();
    action.paused = true;
    trexAction.current = action;
    return () => {
      trexMixer.stopAllAction();
      trexAction.current = null;
    };
  }, [trexMixer, specialAnimations]);

  // Scorpion animation mixer for remote players (Idle / Walk / Area Attack)
  const scorpionMixer = useMemo(() => {
    if (!isScorpion || !clonedSpecialScene || specialAnimations.length === 0) return null;
    return new THREE.AnimationMixer(clonedSpecialScene);
  }, [isScorpion, clonedSpecialScene, specialAnimations]);

  const scorpionActionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const scorpionStateRef = useRef<'idle' | 'walk' | 'attack'>('idle');
  const scorpionAttackingRef = useRef(false);
  const scorpionPrevAttacking = useRef(false);

  useEffect(() => {
    if (!scorpionMixer || specialAnimations.length === 0) return;
    const map: Record<string, THREE.AnimationAction> = {};
    for (const clip of specialAnimations) {
      map[clip.name] = scorpionMixer.clipAction(clip);
    }
    scorpionActionsRef.current = map;

    // Configure looping clips
    for (const name of ['Idle', 'Walk']) {
      const action = map[name];
      if (action) {
        action.setLoop(THREE.LoopRepeat, Infinity);
        action.clampWhenFinished = false;
      }
    }

    // Configure one-shot attack clip
    const attackAction = map['Area Attack'];
    if (attackAction) {
      attackAction.setLoop(THREE.LoopOnce, 1);
      attackAction.clampWhenFinished = true;
    }

    // Start with Idle
    const idleAction = map['Idle'];
    if (idleAction) {
      idleAction.reset().play();
      scorpionStateRef.current = 'idle';
    }

    // When attack finishes, crossfade back to Idle (the frame-loop
    // state-mismatch check will correct to Walk if still moving)
    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === map['Area Attack']) {
        scorpionAttackingRef.current = false;
        const targetAction = map['Idle'];
        if (targetAction) {
          e.action.fadeOut(0.2);
          targetAction.reset().fadeIn(0.2).play();
          scorpionStateRef.current = 'idle';
        }
      }
    };
    scorpionMixer.addEventListener('finished', onFinished);

    return () => {
      scorpionMixer.removeEventListener('finished', onFinished);
      scorpionMixer.stopAllAction();
      scorpionActionsRef.current = {};
      scorpionStateRef.current = 'idle';
      scorpionAttackingRef.current = false;
    };
  }, [scorpionMixer, specialAnimations]);

  // Spitting cobra animation mixer for remote players (idle with play/pause + attack)
  const snakeMixer = useMemo(() => {
    if (!isSpittingCobra || !clonedSpecialScene || specialAnimations.length === 0) return null;
    return new THREE.AnimationMixer(clonedSpecialScene);
  }, [isSpittingCobra, clonedSpecialScene, specialAnimations]);

  const snakeActionsRef = useRef<Record<string, THREE.AnimationAction>>({});
  const snakeStateRef = useRef<'idle' | 'attack'>('idle');
  const snakeAttackingRef = useRef(false);
  const snakePrevAttacking = useRef(false);
  const snakePrevMoving = useRef(false);

  useEffect(() => {
    if (!snakeMixer || specialAnimations.length === 0) return;
    const map: Record<string, THREE.AnimationAction> = {};
    for (const clip of specialAnimations) {
      map[clip.name] = snakeMixer.clipAction(clip);
    }
    snakeActionsRef.current = map;

    const resolveClip = (keywords: string[]): THREE.AnimationAction | null => {
      for (const kw of keywords) {
        const match = specialAnimations.find(c => c.name.toLowerCase().includes(kw.toLowerCase()));
        if (match && map[match.name]) return map[match.name];
      }
      return null;
    };

    const idleAction = resolveClip(['idle', 'rest', 'stand']) ?? Object.values(map).find(Boolean);
    if (idleAction) {
      idleAction.reset();
      idleAction.setLoop(THREE.LoopRepeat, Infinity);
      idleAction.clampWhenFinished = false;
      idleAction.play();
      idleAction.paused = true;
      snakeStateRef.current = 'idle';
    }

    const attackAction = resolveClip(['attack', 'bite', 'strike', 'hit', 'sting']);
    if (attackAction) {
      attackAction.setLoop(THREE.LoopOnce, 1);
      attackAction.clampWhenFinished = true;
    }

    const onFinished = (e: { action: THREE.AnimationAction }) => {
      if (e.action === attackAction) {
        snakeAttackingRef.current = false;
        if (idleAction) {
          e.action.fadeOut(0.2);
          idleAction.reset().fadeIn(0.2).play();
          idleAction.paused = !snakePrevMoving.current;
          snakeStateRef.current = 'idle';
        }
      }
    };
    snakeMixer.addEventListener('finished', onFinished as any);

    return () => {
      snakeMixer.removeEventListener('finished', onFinished as any);
      snakeMixer.stopAllAction();
      snakeActionsRef.current = {};
      snakeStateRef.current = 'idle';
      snakeAttackingRef.current = false;
    };
  }, [snakeMixer, specialAnimations]);

  // Update target position when player data changes
  useEffect(() => {
    targetPos.current.set(
      player.targetPosition.x,
      player.targetPosition.y,
      player.targetPosition.z
    );
    targetRot.current = player.targetRotation;
  }, [player.targetPosition, player.targetRotation]);

  // Update attack state
  useEffect(() => {
    if (player.isAttacking && !isAttacking.current) {
      isAttacking.current = true;
      attackProgress.current = 0;
    }
  }, [player.isAttacking]);

  // Interpolation factor (0.15 gives smooth movement)
  const LERP_FACTOR = 0.15;
  const ATTACK_DURATION = 0.2;

  useFrame((state, delta) => {
    if (!groupRef.current) return;

    // Interpolate position
    currentPos.current.lerp(targetPos.current, LERP_FACTOR);
    
    // Interpolate rotation (simple lerp for Y-axis rotation)
    const rotDiff = targetRot.current - currentRot.current;
    // Handle angle wrapping
    let normalizedDiff = rotDiff;
    if (normalizedDiff > Math.PI) normalizedDiff -= Math.PI * 2;
    if (normalizedDiff < -Math.PI) normalizedDiff += Math.PI * 2;
    currentRot.current += normalizedDiff * LERP_FACTOR;

    // Apply to group
    groupRef.current.position.copy(currentPos.current);
    groupRef.current.rotation.y = currentRot.current;

    // Tarantula animation for remote players - infer movement from position delta
    if (isTarantula && tarantulaMixer) {
      const posDelta = currentPos.current.distanceTo(prevPos.current);
      const rotDelta = Math.abs(targetRot.current - currentRot.current);
      const isRemoteMoving = posDelta > 0.005 || rotDelta > 0.01;
      if (isRemoteMoving && !remotePrevMoving.current && tarantulaAction.current) {
        tarantulaAction.current.paused = false;
      } else if (!isRemoteMoving && remotePrevMoving.current && tarantulaAction.current) {
        tarantulaAction.current.paused = true;
      }
      remotePrevMoving.current = isRemoteMoving;
      if (!player.characterVariant.startsWith('lego')) {
        prevPos.current.copy(currentPos.current);
      }
      tarantulaMixer.update(delta);
    }

    // Scorpion animation for remote players - Idle / Walk / Area Attack
    if (isScorpion && scorpionMixer) {
      const actions = scorpionActionsRef.current;
      const posDelta = currentPos.current.distanceTo(prevPos.current);
      const isRemoteMoving = posDelta > 0.005;
      prevPos.current.copy(currentPos.current);

      // Handle attack: detect rising edge of player.isAttacking
      const remoteAttackNow = player.isAttacking;
      if (remoteAttackNow && !scorpionPrevAttacking.current) {
        scorpionAttackingRef.current = true;
        const attackAction = actions['Area Attack'];
        if (attackAction) {
          const currentName = scorpionStateRef.current === 'walk' ? 'Walk' : 'Idle';
          const currentAction = actions[currentName];
          if (currentAction) currentAction.fadeOut(0.15);
          attackAction.stop().reset().fadeIn(0.15).play();
          scorpionStateRef.current = 'attack';
        }
      }
      scorpionPrevAttacking.current = remoteAttackNow;

      // Handle Walk / Idle transitions (only when not attacking).
      // Use state-mismatch detection so transitions are never missed.
      if (!scorpionAttackingRef.current) {
        const desiredState = isRemoteMoving ? 'walk' : 'idle';
        if (desiredState !== scorpionStateRef.current) {
          if (desiredState === 'walk') {
            const idleAction = actions['Idle'];
            const walkAction = actions['Walk'];
            if (idleAction && walkAction) {
              idleAction.fadeOut(0.2);
              walkAction.reset().fadeIn(0.2).play();
              scorpionStateRef.current = 'walk';
            }
          } else {
            const walkAction = actions['Walk'];
            const idleAction = actions['Idle'];
            if (walkAction && idleAction) {
              walkAction.fadeOut(0.2);
              idleAction.reset().fadeIn(0.2).play();
              scorpionStateRef.current = 'idle';
            }
          }
        }
      }

      scorpionMixer.update(delta);
    }

    // T-Rex animation for remote players - walk on movement, roar burst on attack
    if (isTrex && trexMixer && trexAction.current) {
      const action = trexAction.current;
      const posDelta = currentPos.current.distanceTo(prevPos.current);
      const isRemoteMoving = posDelta > 0.005;
      if (!isTarantula && !isScorpion) {
        prevPos.current.copy(currentPos.current);
      }

      // Detect attack rising edge from network
      const remoteAttackNow = player.isAttacking;
      if (remoteAttackNow && !trexPrevAttacking.current && !trexAttackingRef.current) {
        trexAttackingRef.current = true;
        trexAttackTimer.current = 0;
        action.paused = false;
        action.timeScale = 2.5;
      }
      trexPrevAttacking.current = remoteAttackNow;

      // Count down attack burst
      if (trexAttackingRef.current) {
        trexAttackTimer.current += delta;
        if (trexAttackTimer.current >= TREX_ATTACK_DURATION) {
          trexAttackingRef.current = false;
          action.timeScale = 1;
          if (!isRemoteMoving) {
            action.paused = true;
          }
        }
      }

      // Walk / Idle transitions when not attacking
      if (!trexAttackingRef.current) {
        if (isRemoteMoving && !trexPrevMoving.current) {
          action.paused = false;
          action.timeScale = 1;
        } else if (!isRemoteMoving && trexPrevMoving.current) {
          action.paused = true;
        }
      }
      trexPrevMoving.current = isRemoteMoving;

      trexMixer.update(delta);
    }

    // Spitting cobra animation for remote players - idle play/pause + attack
    if (isSpittingCobra && snakeMixer) {
      const actions = snakeActionsRef.current;
      const posDelta = currentPos.current.distanceTo(prevPos.current);
      const isRemoteMoving = posDelta > 0.005;
      prevPos.current.copy(currentPos.current);

      const resolveAction = (keywords: string[]): THREE.AnimationAction | null => {
        for (const kw of keywords) {
          const match = Object.keys(actions).find(n => n.toLowerCase().includes(kw.toLowerCase()));
          if (match && actions[match]) return actions[match];
        }
        return null;
      };

      const idleAction = resolveAction(['idle', 'rest', 'stand']) ?? Object.values(actions).find(Boolean);
      const attackAction = resolveAction(['attack', 'bite', 'strike', 'hit', 'sting']);

      const remoteAttackNow = player.isAttacking;
      if (remoteAttackNow && !snakePrevAttacking.current && !snakeAttackingRef.current && attackAction) {
        snakeAttackingRef.current = true;
        if (idleAction) idleAction.fadeOut(0.2);
        attackAction.stop().reset().fadeIn(0.2).play();
        snakeStateRef.current = 'attack';
      }
      snakePrevAttacking.current = remoteAttackNow;

      if (!snakeAttackingRef.current && idleAction) {
        if (isRemoteMoving && !snakePrevMoving.current) {
          idleAction.paused = false;
        } else if (!isRemoteMoving && snakePrevMoving.current) {
          idleAction.paused = true;
        }
      }
      snakePrevMoving.current = isRemoteMoving;

      snakeMixer.update(delta);
    }

    // Handle attack animation
    if (isAttacking.current && !specialModelPath && swordRef.current) {
      attackProgress.current += delta;
      const progress = Math.min(attackProgress.current / ATTACK_DURATION, 1);
      
      const swingAngle = Math.sin(progress * Math.PI) * 2;
      swordRef.current.rotation.x = swingAngle;

      if (progress >= 1) {
        isAttacking.current = false;
        swordRef.current.rotation.x = 0;
      }
    } else if (!player.isAttacking && !specialModelPath && swordRef.current) {
      // Reset sword if attack ended from network
      isAttacking.current = false;
      swordRef.current.rotation.x = 0;
    }
  });

  return (
    <group ref={groupRef} rotation={[0, Math.PI, 0]}>
      {/* Character model */}
      {specialModelPath && clonedSpecialScene && specialTransform ? (
        <group ref={swimRef}>
          <primitive
            object={clonedSpecialScene}
            scale={specialTransform.scale}
            rotation={[0, specialTransform.rotationY, 0]}
            position={[specialTransform.x, specialTransform.y, specialTransform.z]}
          />
        </group>
      ) : (
        <primitive object={clonedScene} scale={2.5} rotation={[0, -Math.PI / 2, 0]} />
      )}
      
      {/* Sword with lightsaber effect */}
      {!specialModelPath && <group position={[0.6, 1.2, 0]} ref={swordRef}>
        <pointLight 
          position={[0, 0.7, 0.3]}
          color="#60A5FA" 
          intensity={1.5} 
          distance={6}
          decay={2}
        />
        
        <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} castShadow>
          <coneGeometry args={[0.12, 1.6, 4]} />
          <meshStandardMaterial 
            color="#a5d8ff"
            emissive="#60A5FA"
            emissiveIntensity={0.6}
            metalness={0.9} 
            roughness={0.1} 
          />
        </mesh>
        
        <mesh position={[0, 0.7, 0.3]} rotation={[0, Math.PI/4, 0]} scale={[0.6, 0.9, 0.6]}>
          <coneGeometry args={[0.12, 1.6, 4]} />
          <meshBasicMaterial 
            color="#93C5FD"
            transparent
            opacity={0.4}
          />
        </mesh>
        
        <mesh position={[0, -0.3, 0.3]}>
          <cylinderGeometry args={[0.08, 0.08, 0.4]} />
          <meshStandardMaterial color="#78350f" />
        </mesh>
        <mesh position={[0, -0.1, 0.3]} rotation={[Math.PI/2, 0, 0]}>
          <boxGeometry args={[0.4, 0.1, 0.1]} />
          <meshStandardMaterial 
            color="#fcd34d" 
            emissive="#fcd34d"
            emissiveIntensity={0.3}
          />
        </mesh>
      </group>}
      
      {/* Name tag above head */}
      {showNameTag && (
        <Html
          position={[0, 4.5, 0]}
          center
          distanceFactor={15}
          sprite
        >
          <div className="px-3 py-1 bg-black/70 rounded-full text-white text-sm font-bold whitespace-nowrap backdrop-blur-sm border border-white/20">
            {player.name}
          </div>
        </Html>
      )}
    </group>
  );
};

// Preload the model
useGLTF.preload('/models/deathvader-optimized.glb');
useGLTF.preload('/models/rigged-t-rex-fabulous/source/rigged_t-rex_fabulous.glb');
useGLTF.preload('/models/distortus_rex.glb');
useGLTF.preload('/models/war_dinosaur_-_rigged.glb');
useGLTF.preload('/models/theraphosa-blondi/source/hi-fi-spider.glb');
useGLTF.preload('/models/scorpion.glb');
useGLTF.preload('/models/snake_attack_animations_multiple.glb');

export default RemotePlayer;

