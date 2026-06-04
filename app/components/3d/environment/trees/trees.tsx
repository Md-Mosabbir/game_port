import { useLayoutEffect, useRef, useMemo, useEffect, useState } from 'react';
import { useTexture } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { uniform } from 'three/tsl';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

import { useStylizedBushGeometry } from '../bush/bush-geo';
import { createCanopyMaterial } from './canopy-mat';
import { createTrunkMaterial } from './trunk-mat';

interface TreesProps {
  count: number;
  planeCount: number;
  config: any;
  chasisBodyRef?: any;
  fieldSize?: number;
}

const BRANCH_CONFIGS = [
  { heightFrac: 0.45, lengthFrac: 0.45, angle: 0.65, rotY: 0 },
  { heightFrac: 0.45, lengthFrac: 0.42, angle: 0.65, rotY: Math.PI * 0.6 },
  { heightFrac: 0.45, lengthFrac: 0.38, angle: 0.65, rotY: Math.PI * 1.2 },
  { heightFrac: 0.65, lengthFrac: 0.32, angle: 0.55, rotY: Math.PI * 0.3 },
  { heightFrac: 0.65, lengthFrac: 0.30, angle: 0.55, rotY: Math.PI * 0.9 },
  { heightFrac: 0.65, lengthFrac: 0.28, angle: 0.55, rotY: Math.PI * 1.5 },
];

export function Trees({
  count,
  planeCount,
  config,
  chasisBodyRef,
  fieldSize = 100
}: TreesProps) {

  const trunkRef = useRef<THREE.InstancedMesh>(null!);
  const canopyRef = useRef<THREE.InstancedMesh>(null!);

  const baseHeight = config.treeHeight || 9.0; // Updated base height default

  const [noiseTex, alphaTex] = useTexture([
    '/textures/perlin_noise.png',
    '/textures/alpha.png',
  ]);

  const canopyGeometry = useStylizedBushGeometry(planeCount, {
    bushRadius: config.treeBushRadius,
    innerDensity: 1.5,
  });

  // ─────────────────────────────────────────────
  // THE MAGIC: Pre-bake Trunk & Branches into ONE Geometry
  // ─────────────────────────────────────────────
  const mergedTrunkGeometry = useMemo(() => {
    const geometries: THREE.BufferGeometry[] = [];

    // 1. Main Trunk (Offset so Y=0 is the base)
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, baseHeight, 16);
    trunkGeo.translate(0, baseHeight / 2, 0); 
    geometries.push(trunkGeo);

    // 2. Branches
    const dummy = new THREE.Object3D();

    BRANCH_CONFIGS.forEach((bc) => {
      const len = baseHeight * bc.lengthFrac;
      const attachY = baseHeight * bc.heightFrac;

      // Create a fresh cylinder for this branch using its calculated length
      const branchGeo = new THREE.CylinderGeometry(0.03, 0.09, len, 8);
      
      // [FIXED] Shift the branch geometry up by half its length.
      // This permanently repositions its local origin (0,0,0) to its bottom base.
      branchGeo.translate(0, len / 2, 0);

      // Now we reset our dummy object cleanly
      dummy.position.set(0, attachY, 0);             // Snap origin directly to trunk height
      dummy.rotation.set(bc.angle, bc.rotY, 0, 'YXZ'); // Rotate cleanly outward from the base pivot
      dummy.scale.set(1, 1, 1);                        // Reset scale since len is built into geometry
      dummy.updateMatrix();

      // Apply the transformation matrix directly to the geometry vertices
      branchGeo.applyMatrix4(dummy.matrix);
      geometries.push(branchGeo);
    });

    return BufferGeometryUtils.mergeGeometries(geometries);
  }, [baseHeight]);

  const uniforms = useMemo(() => ({
    cameraXZ: uniform(new THREE.Vector2()),
    fieldSize: uniform(fieldSize),
  }), [fieldSize]);

  const [trunkMat, setTrunkMat] = useState<any>(null);
  const [canopyMat, setCanopyMat] = useState<any>(null);

  useEffect(() => {
    if (!noiseTex || !alphaTex) return;
    setTrunkMat(createTrunkMaterial(uniforms, config));
    setCanopyMat(createCanopyMaterial(uniforms, noiseTex, alphaTex, config));
  }, [noiseTex, alphaTex, config]);

  const spawnData = useMemo(() => (
    Array.from({ length: count }, () => {
      const scale = 0.8 + Math.random() * 0.5;
      return {
        x: (Math.random() - 0.5) * fieldSize,
        z: (Math.random() - 0.5) * fieldSize,
        scale: scale,
        height: baseHeight * scale, 
        rotY: Math.random() * Math.PI * 2,
      };
    })
  ), [count, fieldSize, baseHeight]);

  const dummy = useMemo(() => new THREE.Object3D(), []);

  useFrame(() => {
    if (trunkMat?.userData?.uSpeed) {
      trunkMat.userData.uSpeed.value = config.windSpeed;
      trunkMat.userData.uIntensity.value = config.swayIntensity;
    }

    if (canopyMat?.userData?.uSpeed) {
      canopyMat.userData.uSpeed.value = config.windSpeed;
      canopyMat.userData.uIntensity.value = config.swayIntensity;
    }

    const carWorldPos = { x: 0, z: 0 };
    if (chasisBodyRef?.current) {
      const t = chasisBodyRef.current.translation();
      carWorldPos.x = t.x;
      carWorldPos.z = t.z;
    }

    uniforms.cameraXZ.value.set(carWorldPos.x, carWorldPos.z);
  });

  useLayoutEffect(() => {
    if (!trunkRef.current || !canopyRef.current) return;

    const spawnXZ = new Float32Array(count * 2);

    for (let i = 0; i < count; i++) {
      const d = spawnData[i];

      spawnXZ[i * 2] = d.x;
      spawnXZ[i * 2 + 1] = d.z;

      // Unified Trunk Matrix Mapping
      dummy.position.set(0, 0, 0); 
      dummy.scale.setScalar(d.scale);
      dummy.rotation.set(0, d.rotY, 0);
      dummy.updateMatrix();
      trunkRef.current.setMatrixAt(i, dummy.matrix);

      // Canopy Placement Matrix Mapping
      dummy.position.set(0, d.height, 0);
      dummy.scale.setScalar(d.scale);
      dummy.rotation.set(0, d.rotY, 0);
      dummy.updateMatrix();
      canopyRef.current.setMatrixAt(i, dummy.matrix);
    }

    trunkRef.current.instanceMatrix.needsUpdate = true;
    canopyRef.current.instanceMatrix.needsUpdate = true;

    canopyGeometry.setAttribute('aSpawnXZ', new THREE.InstancedBufferAttribute(spawnXZ, 2));
    mergedTrunkGeometry.setAttribute('aSpawnXZ', new THREE.InstancedBufferAttribute(spawnXZ, 2));
    
  }, [spawnData, canopyGeometry, mergedTrunkGeometry]);

  return (
    <group>
      <instancedMesh
        ref={trunkRef}
        args={[mergedTrunkGeometry, trunkMat, count]}
        frustumCulled={false}
        castShadow
        receiveShadow
      />

      <instancedMesh
        ref={canopyRef}
        args={[canopyGeometry, canopyMat, count]}
        frustumCulled={false}
        castShadow
      />
    </group>
  );
}