'use client';

import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Stats } from '@react-three/drei';
import { MeshStandardNodeMaterial, WebGPURenderer } from 'three/webgpu';
import { useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { color } from 'three/tsl';

import { Sky } from '@/app/components/3d/environment/sky';
import { WorldLighting } from '@/app/components/3d/environment/world-lighting';
import { setupLightingControls } from '@/app/controls/lightingControls';
import { setupPlaygroundControls, diffusionUniforms } from '@/app/controls/playgroundControls';
import { stylizedDiffusion, stylizedBounce } from '../components/3d/stylised/stylizedMaterial';

const GHIBLI_COLORS = [
    '#9fb58b', '#5c7b64', '#d6c196', '#b46a53', '#748b9c', '#e4d5b7', '#a3b899'
];

// Single shared temporary vector to avoid memory allocation every frame
const _lightDir = new THREE.Vector3();

const StylizedMesh = ({ geometry, position, baseColor }: { geometry: THREE.BufferGeometry, position: [number, number, number], baseColor: string }) => {
    const material = useMemo(() => {
        const mat = new MeshStandardNodeMaterial({
            roughness: 0.5,
            metalness: 0.0
        });
        
        const diffused = stylizedDiffusion(
            color(baseColor),
            diffusionUniforms.lightDirection,
            diffusionUniforms.diffusionLow,
            diffusionUniforms.diffusionHigh
        );

        mat.colorNode = stylizedBounce(
            diffused,
            diffusionUniforms.bounceColor,
            diffusionUniforms.bounceStrength,
            diffusionUniforms.bounceLow,
            diffusionUniforms.bounceHigh,
            diffusionUniforms.bounceMaxDist,
            diffusionUniforms.floorY
        );

        return mat;
    }, [baseColor]);

    return (
        <mesh position={position} castShadow receiveShadow geometry={geometry}>
            <primitive object={material} attach="material" />
        </mesh>
    );
};

const StylizedObjects = () => {
    // 1. Keep geometries inside useMemo to preserve memory across mounts
    const sphereGeo = useMemo(() => new THREE.SphereGeometry(2, 32, 32), []);
    const boxGeo = useMemo(() => new THREE.BoxGeometry(3, 3, 3), []);
    const centralBoxGeo = useMemo(() => new THREE.BoxGeometry(4, 4, 4), []);
    const planeGeo = useMemo(() => new THREE.PlaneGeometry(100, 100), []);

    // 2. Generate random positions once safely
    const items = useMemo(() => {
        const generated = [];
        for (let i = 0; i < 10; i++) {
            generated.push({
                type: 'sphere',
                position: [(Math.random() - 0.5) * 40, 2, (Math.random() - 0.5) * 40] as [number, number, number],
                color: GHIBLI_COLORS[Math.floor(Math.random() * GHIBLI_COLORS.length)]
            });
            generated.push({
                type: 'cube',
                position: [(Math.random() - 0.5) * 40, 2, (Math.random() - 0.5) * 40] as [number, number, number],
                color: GHIBLI_COLORS[Math.floor(Math.random() * GHIBLI_COLORS.length)]
            });
        }
        return generated;
    }, []);

    const groundMaterial = useMemo(() => {
        const mat = new MeshStandardNodeMaterial({ roughness: 0.8, metalness: 0.0 });
        const diffused = stylizedDiffusion(
            color('#4a5e42'), 
            diffusionUniforms.lightDirection,
            diffusionUniforms.diffusionLow,
            diffusionUniforms.diffusionHigh
        );
        mat.colorNode = stylizedBounce(
            diffused,
            diffusionUniforms.bounceColor,
            diffusionUniforms.bounceStrength,
            diffusionUniforms.bounceLow,
            diffusionUniforms.bounceHigh,
            diffusionUniforms.bounceMaxDist,
            diffusionUniforms.floorY
        );
        return mat;
    }, []);

    // 3. Centralized frame loop updates the dynamic uniform values directly on the GPU
    useFrame((state) => {
        const currentLight = state.scene.children.find(c => c.type === 'DirectionalLight') as THREE.DirectionalLight;
        if (currentLight) {
            // Read light position, normalize it to turn it into a directional vector, and inject it into TSL
            _lightDir.copy(currentLight.position).normalize();
            diffusionUniforms.lightDirection.value.copy(_lightDir);
        }
    });

    return (
        <group>
            {/* Ground Plane */}
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow geometry={planeGeo}>
                <primitive object={groundMaterial} attach="material" />
            </mesh>

            {/* Central Box */}
            <StylizedMesh geometry={centralBoxGeo} position={[0, 2, 0]} baseColor="#d6c196" />

            {/* Scattered Items */}
            {items.map((item, i) => (
                <StylizedMesh 
                    key={i}
                    geometry={item.type === 'sphere' ? sphereGeo : boxGeo}
                    position={item.position}
                    baseColor={item.color}
                />
            ))}
        </group>
    );
};

export default function PlaygroundPage() {
    useEffect(() => {
        setupLightingControls();
        setupPlaygroundControls();
    }, []);

    return (
        <main style={{ width: '100vw', height: '100vh', background: '#000' }}>
            <Canvas
                shadows
                camera={{ position: [0, 10, 30], fov: 45 }}
                gl={async (props) => {
                    const r = new WebGPURenderer(props);
                    return await r.init();
                }}
            >
                <Sky />
                <WorldLighting />
                <Stats />
                <OrbitControls makeDefault />
                <StylizedObjects />
            </Canvas>
        </main>
    );
}