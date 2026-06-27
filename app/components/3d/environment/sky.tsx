import { Float, Sparkles } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';

export const Sky = () => {
  const { scene } = useThree();

  useFrame(() => {
    // Make fog responsive to Tweakpane
    if (scene.background instanceof THREE.Color) {
      scene.background.set(LIGHTING_CONFIG.fogColor);
    }
    if (scene.fog instanceof THREE.Fog) {
      scene.fog.color.set(LIGHTING_CONFIG.fogColor);
      scene.fog.near = LIGHTING_CONFIG.fogNear;
      scene.fog.far = LIGHTING_CONFIG.fogFar;
    }
  });

  return (
    <>
      <color attach="background" args={[LIGHTING_CONFIG.fogColor]} />
      <fog attach="fog" args={[LIGHTING_CONFIG.fogColor, LIGHTING_CONFIG.fogNear, LIGHTING_CONFIG.fogFar]} />

      {/* Floating particles to catch the 'light' */}
      <Sparkles
        count={200}
        scale={100}
        size={2}
        speed={0.4}
        color="#ffccaa"
        opacity={0.5}
      />
    </>
  );
};
