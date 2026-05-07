import { Sky as SkyDrei, Float, Sparkles } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import * as THREE from 'three';
import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';

export const Sky = () => {
  const sunRef = useRef<THREE.Group>(null!);

  return (
    <>
      <color attach="background" args={[LIGHTING_CONFIG.fogColor]} />
      <fog attach="fog" args={[LIGHTING_CONFIG.fogColor, LIGHTING_CONFIG.fogNear, LIGHTING_CONFIG.fogFar]} />
      {/* Base Sky Component with Autumn Sunset settings */}
      <SkyDrei
        distance={450000}
        sunPosition={[100, 20, -50]}
        turbidity={8}
        rayleigh={3}
        mieCoefficient={0.005}
        mieDirectionalG={0.8}
      />

    

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
