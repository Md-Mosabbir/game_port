import { useMemo } from 'react';
import * as THREE from 'three';
import { GRASS_SETTINGS } from './grass-config';

export function useGrassGeometry(count: number, config: any) {
    return useMemo(() => {
        console.log(`[Grass] Generating geometry for ${count} blades...`);
        const geo = new THREE.BufferGeometry();
        const positions = new Float32Array(count * 9);
        const clusterCenters = new Float32Array(count * 9);
        const bladeOffsets = new Float32Array(count * 9);
        const tipness = new Float32Array(count * 3);
        const phases = new Float32Array(count * 3);

        for (let i = 0; i < count; i++) {
            const i9 = i * 9;
            const i3 = i * 3;

            // Randomness seeds
            const r0 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
            const r1 = ((Math.sin((i + 101) * 78.233) * 43758.5453) % 1 + 1) % 1;
            const r2 = ((Math.sin((i + 503) * 39.425) * 43758.5453) % 1 + 1) % 1;
            const r3 = ((Math.sin((i + 997) * 15.891) * 43758.5453) % 1 + 1) % 1;

            const clusterIndex = i % config.clusterCount;
            const cR0 = ((Math.sin((clusterIndex + 73) * 21.97) * 43758.5453) % 1 + 1) % 1;
            const cR1 = ((Math.sin((clusterIndex + 311) * 56.11) * 43758.5453) % 1 + 1) % 1;
            
            const centerX = (cR0 - 0.5) * GRASS_SETTINGS.FIELD_SIZE;
            const centerZ = (cR1 - 0.5) * GRASS_SETTINGS.FIELD_SIZE;

            const angle = r0 * Math.PI * 2;
            const radius = Math.sqrt(r1) * config.clusterSpread;
            let absoluteX = THREE.MathUtils.clamp(centerX + Math.cos(angle) * radius, -GRASS_SETTINGS.FIELD_SIZE/2, GRASS_SETTINGS.FIELD_SIZE/2);
            let absoluteZ = THREE.MathUtils.clamp(centerZ + Math.sin(angle) * radius, -GRASS_SETTINGS.FIELD_SIZE/2, GRASS_SETTINGS.FIELD_SIZE/2);

            const width = 0.05 + r2 * 0.08;
            const height = 0.8 + r3 * 0.9;

            // Triangle Vertices
            positions[i9 + 0] = -width; positions[i9 + 1] = 0;      positions[i9 + 2] = 0;
            positions[i9 + 3] =  width; positions[i9 + 4] = 0;      positions[i9 + 5] = 0;
            positions[i9 + 6] =  0;      positions[i9 + 7] = height; positions[i9 + 8] = 0;

            for (let j = 0; j < 9; j += 3) {
                clusterCenters[i9 + j] = centerX;
                clusterCenters[i9 + j + 2] = centerZ;
                bladeOffsets[i9 + j] = absoluteX - centerX;
                bladeOffsets[i9 + j + 2] = absoluteZ - centerZ;
            }

            tipness[i3 + 2] = 1;
            phases[i3] = phases[i3+1] = phases[i3+2] = r2 * Math.PI * 2.0;
        }

        geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geo.setAttribute('aClusterCenter', new THREE.BufferAttribute(clusterCenters, 3));
        geo.setAttribute('aBladeOffset', new THREE.BufferAttribute(bladeOffsets, 3));
        geo.setAttribute('aTipness', new THREE.BufferAttribute(tipness, 1));
        geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));

        return geo;
    }, [count, config.clusterCount, config.clusterSpread]);
}