import { useLayoutEffect, useRef, useMemo, useEffect, useState } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { uniform } from 'three/tsl';
import { useStylizedBushGeometry } from './bush-geo';
import { createBushMaterial } from './bush-mat';



interface BushesProps {
    count: number;
    planeCount: number;
    config: {
        windSpeed: number;
        swayIntensity: number;
        bushRadius: number;
        innerDensity: number;
    };
    chasisBodyRef?: any;
    fieldSize?: number;
}

export function Bushes({ count, planeCount, config, chasisBodyRef, fieldSize = 100 }: BushesProps) {
    const meshRef = useRef<THREE.InstancedMesh>(null!);
    const [material, setMaterial] = useState<any>(null);

    const [noiseTex, alphaTex] = useTexture([
        '/textures/perlin_noise.png',
        '/textures/alpha.png',
    ]);

    const geometry = useStylizedBushGeometry(planeCount, config);

    // Only needs cameraXZ and fieldSize — no FBO, no car crush
    const uniforms = useMemo(() => ({
        cameraXZ:  uniform(new THREE.Vector2()),
        fieldSize: uniform(fieldSize),
    }), [fieldSize]);

    useEffect(() => {
        if (!noiseTex || !alphaTex) return;
        const { material: mat } = createBushMaterial(uniforms, noiseTex, alphaTex);
        setMaterial(mat);
    }, [noiseTex, alphaTex]);

    // Bake spawn positions into aSpawnXZ — shader wraps them, no CPU work per frame
    useLayoutEffect(() => {
        if (!meshRef.current) return;

        const spawnXZ = new Float32Array(count * 2);
        const dummy   = new THREE.Object3D();

        for (let i = 0; i < count; i++) {
            const x     = (Math.random() - 0.5) * fieldSize;
            const z     = (Math.random() - 0.5) * fieldSize;
            const scale = 0.7 + Math.random() * 0.6;
            const rotY  = Math.random() * Math.PI * 2;

            spawnXZ[i * 2]     = x;
            spawnXZ[i * 2 + 1] = z;

            dummy.position.set(0, 0, 0); // shader handles world XZ
            dummy.scale.setScalar(scale);
            dummy.rotation.y = rotY;
            dummy.updateMatrix();
            meshRef.current.setMatrixAt(i, dummy.matrix);
        }

        meshRef.current.instanceMatrix.needsUpdate = true;
        geometry.setAttribute('aSpawnXZ', new THREE.InstancedBufferAttribute(spawnXZ, 2));
    }, [count, fieldSize, geometry]);

    useFrame(() => {
        if (material?.userData.uSpeed) {
            material.userData.uSpeed.value     = config.windSpeed;
            material.userData.uIntensity.value = config.swayIntensity;
        }

        // Just track car position for wrapping — no FBO needed
        const carWorldPos = { x: 0, z: 0 };
        if (chasisBodyRef?.current) {
            const t = chasisBodyRef.current.translation();
            carWorldPos.x = t.x;
            carWorldPos.z = t.z;
        }

        uniforms.cameraXZ.value.set(carWorldPos.x, carWorldPos.z);
    });

    return (
        <instancedMesh
            ref={meshRef}
            args={[geometry, material, count]}
            frustumCulled={false}
            castShadow
            receiveShadow
         
        customDepthMaterial={material}
        />
    );
}