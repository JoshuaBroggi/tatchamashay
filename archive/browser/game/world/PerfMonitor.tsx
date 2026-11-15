/**
 * Lightweight in-game performance HUD for dev builds.
 * Shows FPS, frame time, draw calls, triangles, and active quality tier.
 * Only renders when enabled via the `show` prop or when __DEV_PERF__ is set.
 */

import React, { useRef, useState, useEffect } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import { getQualityTier } from './quality';

interface PerfStats {
  fps: number;
  frameTime: number;
  drawCalls: number;
  triangles: number;
  geometries: number;
  textures: number;
}

export const PerfMonitor: React.FC<{ show?: boolean }> = ({ show = false }) => {
  const { gl } = useThree();
  const statsRef = useRef<PerfStats>({
    fps: 0,
    frameTime: 0,
    drawCalls: 0,
    triangles: 0,
    geometries: 0,
    textures: 0,
  });
  const [display, setDisplay] = useState<PerfStats>(statsRef.current);
  const frameCountRef = useRef(0);
  const lastTimeRef = useRef(performance.now());

  // Update display at ~4 Hz to avoid DOM thrash
  useFrame(() => {
    frameCountRef.current++;
    const now = performance.now();
    const elapsed = now - lastTimeRef.current;

    if (elapsed >= 250) {
      const info = gl.info;
      statsRef.current = {
        fps: Math.round((frameCountRef.current / elapsed) * 1000),
        frameTime: Math.round(elapsed / frameCountRef.current * 100) / 100,
        drawCalls: info.render.calls,
        triangles: info.render.triangles,
        geometries: info.memory.geometries,
        textures: info.memory.textures,
      };
      setDisplay({ ...statsRef.current });
      frameCountRef.current = 0;
      lastTimeRef.current = now;
    }
  });

  if (!show) return null;

  const tier = getQualityTier();

  return (
    <Html
      position={[0, 0, 0]}
      style={{
        position: 'fixed',
        top: '60px',
        right: '8px',
        pointerEvents: 'none',
        zIndex: 9999,
      }}
      transform={false}
      zIndexRange={[9999, 9999]}
    >
      <div
        style={{
          background: 'rgba(0,0,0,0.75)',
          color: '#0f0',
          fontFamily: 'monospace',
          fontSize: '11px',
          padding: '6px 10px',
          borderRadius: '6px',
          lineHeight: 1.5,
          whiteSpace: 'pre',
          minWidth: '160px',
        }}
      >
        {`FPS: ${display.fps}  (${display.frameTime}ms)
Draws: ${display.drawCalls}
Tris:  ${display.triangles}
Geo:   ${display.geometries}  Tex: ${display.textures}
Tier:  ${tier.toUpperCase()}`}
      </div>
    </Html>
  );
};
