"use client";
import { useLayoutEffect, useRef, Suspense, useEffect, useState } from 'react';
import { useTexture, OrbitControls } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

import { WebGPURenderer } from 'three/webgpu';
import { Pane } from 'tweakpane';
import { useStylizedBushGeometry } from '../components/3d/environment/bush/bush-geo';
import { useBushMaterial } from '../components/3d/environment/bush/bush-mat';
import { Bushes } from '../components/3d/environment/bush/bushes';
import { Trees } from '../components/3d/environment/trees/trees';


export default function PlaygroundPage() {
  const [config, setConfig] = useState({
    // --- Ground Foliage Settings ---
    count: 120,
    planeCount: 40,
    bushRadius: 1.2,
    innerDensity: 1.5,

    // --- Tree Generation Settings ---
    treeCount: 35,
    treePlaneCount: 150,
    treeBushRadius: 2.2,

    // --- Global Wind Environment ---
    windSpeed: 0.5,
    swayIntensity: 0.25,
  });

  useEffect(() => {
    const pane = new Pane({
      title: 'Environment Master Panel',
      expanded: true,
    });

    // --- Ground Foliage Controller Folder ---
    const bushFolder = pane.addFolder({ title: 'Ground Bushes' });

    bushFolder.addBinding(config, 'count', { min: 10, max: 500, step: 10 })
      .on('change', (ev) => setConfig((c) => ({ ...c, count: ev.value })));

    bushFolder.addBinding(config, 'planeCount', { min: 5, max: 150, step: 1 })
      .on('change', (ev) => setConfig((c) => ({ ...c, planeCount: ev.value })));

    bushFolder.addBinding(config, 'bushRadius', { min: 0.2, max: 4.0, step: 0.05 })
      .on('change', (ev) => setConfig((c) => ({ ...c, bushRadius: ev.value })));

    // --- Tree Architecture Controller Folder ---
    const treeFolder = pane.addFolder({ title: 'Tree Systems (Re-bakes)' });

    treeFolder.addBinding(config, 'treeCount', { min: 5, max: 100, step: 5 })
      .on('change', (ev) => setConfig((c) => ({ ...c, treeCount: ev.value })));

    treeFolder.addBinding(config, 'treePlaneCount', { min: 10, max: 200, step: 5 })
      .on('change', (ev) => setConfig((c) => ({ ...c, treePlaneCount: ev.value })));

    treeFolder.addBinding(config, 'treeBushRadius', { min: 0.5, max: 5.0, step: 0.1 })
      .on('change', (ev) => setConfig((c) => ({ ...c, treeBushRadius: ev.value })));

    // --- Global Environmental TSL Physics Folder ---
    const environmentFolder = pane.addFolder({ title: 'Global Wind Node Shaders' });

    environmentFolder.addBinding(config, 'windSpeed', { min: 0.0, max: 2.0, step: 0.05 })
      .on('change', (ev) => setConfig((c) => ({ ...c, windSpeed: ev.value })));

    environmentFolder.addBinding(config, 'swayIntensity', { min: 0.0, max: 1.0, step: 0.01 })
      .on('change', (ev) => setConfig((c) => ({ ...c, swayIntensity: ev.value })));

    return () => {
      pane.dispose();
    };
  }, []);

  return (
    <div style={{ width: '100vw', height: '100vh', position: 'relative', background: '#1a1a2e' }}>
      <Canvas
        camera={{ position: [0, 15, 30], fov: 45 }}
        shadows
        gl={async (props) => {
          const r = new WebGPURenderer(props);
          return await r.init();
        }}
        onCreated={({ scene }) => {
          // Creates Bruno Simon's beautiful soft-blue environment horizon color natively
          scene.background = new THREE.Color('#b0d0ff');
          scene.fog = new THREE.FogExp2('#b0d0ff', 0.015);
        }}
      >
        {/* Crisp lighting configured to draw clean geometry shadows across standard materials */}
        <ambientLight intensity={0.6} color="#ffffff" />
        <directionalLight
          position={[20, 25, 15]}
          intensity={1.5}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-camera-far={60}
          shadow-camera-left={-25}
          shadow-camera-right={25}
          shadow-camera-top={25}
          shadow-camera-bottom={-25}
          shadow-bias={-0.0005}
        />

        <Suspense fallback={null}>
          {/* Ground Foliage Layer */}
          <Bushes
            key={`bushes-${config.count}-${config.planeCount}-${config.bushRadius}`}
            count={config.count}
            planeCount={config.planeCount}
            config={config}
          />

          {/* Tree Canopy and Trunk Layer */}
          <Trees
            key={`trees-${config.treeCount}-${config.treePlaneCount}-${config.treeBushRadius}`}
            count={config.treeCount}
            planeCount={config.treePlaneCount}
            config={config}
          />

          {/* A gorgeous, rich ground plateau plane designed to receive crisp shadows */}
          <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
            <planeGeometry args={[120, 120]} />
            <meshStandardMaterial
              color="#3a5334"
              roughness={0.85}
              metalness={0.05}
            />
          </mesh>
        </Suspense>

        <OrbitControls
          makeDefault
          maxPolarAngle={Math.PI / 2 - 0.05} // Locks camera from dipping underneath the floor plain
          minDistance={5}
          maxDistance={60}
        />
      </Canvas>
    </div>
  );
}
