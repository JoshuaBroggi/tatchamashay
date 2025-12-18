import React, { useRef, useMemo, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { useGLTF, Html } from '@react-three/drei';
import * as THREE from 'three';
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
  
  // Get cloak color from character config
  const cloakColor = useMemo(() => {
    const config = CHARACTER_CONFIGS.find(c => c.id === player.characterVariant);
    return config?.cloakColor || '#1a1a1a';
  }, [player.characterVariant]);

  // Clone and color the scene
  const clonedScene = useMemo(() => {
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
  }, [scene, cloakColor]);

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

    // Handle attack animation
    if (isAttacking.current && swordRef.current) {
      attackProgress.current += delta;
      const progress = Math.min(attackProgress.current / ATTACK_DURATION, 1);
      
      const swingAngle = Math.sin(progress * Math.PI) * 2;
      swordRef.current.rotation.x = swingAngle;

      if (progress >= 1) {
        isAttacking.current = false;
        swordRef.current.rotation.x = 0;
      }
    } else if (!player.isAttacking && swordRef.current) {
      // Reset sword if attack ended from network
      isAttacking.current = false;
      swordRef.current.rotation.x = 0;
    }
  });

  return (
    <group ref={groupRef} rotation={[0, Math.PI, 0]}>
      {/* Character model */}
      <primitive object={clonedScene} scale={2.5} rotation={[0, -Math.PI / 2, 0]} />
      
      {/* Sword with lightsaber effect */}
      <group position={[0.6, 1.2, 0]} ref={swordRef}>
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
      </group>
      
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

export default RemotePlayer;

