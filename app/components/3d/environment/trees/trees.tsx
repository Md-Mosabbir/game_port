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
    const baseHeight = 5;

    // 1. Main Trunk (Offset so Y=0 is the base)
    const trunkGeo = new THREE.CylinderGeometry(0.12, 0.2, baseHeight, 16);
    trunkGeo.translate(0, baseHeight / 2, 0); 
    geometries.push(trunkGeo);

    // 2. Branches
    const baseBranchGeo = new THREE.CylinderGeometry(0.05, 0.1, 2, 8); // 2 units tall base
    const dummy = new THREE.Object3D();

    BRANCH_CONFIGS.forEach((bc) => {
      const branchGeo = baseBranchGeo.clone();
      
      const len = baseHeight * bc.lengthFrac;
      const attachY = baseHeight * bc.heightFrac;
      const halfLen = len / 2;

      // Position branch outward and upward
      dummy.position.set(
        Math.sin(bc.angle) * Math.cos(bc.rotY) * halfLen,
        attachY + Math.cos(bc.angle) * halfLen,
        Math.sin(bc.angle) * Math.sin(bc.rotY) * halfLen
      );

      // Rotate and scale branch length
      dummy.rotation.set(bc.angle, bc.rotY, 0, 'YXZ');
      dummy.scale.set(1, len / 2, 1); // Scale Y based on the 2-unit base geometry
      dummy.updateMatrix();

      branchGeo.applyMatrix4(dummy.matrix);
      geometries.push(branchGeo);
    });

    return BufferGeometryUtils.mergeGeometries(geometries);
  }, []);

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
  }, [noiseTex, alphaTex]);

  const spawnData = useMemo(() => (
    Array.from({ length: count }, () => {
      const scale = 0.8 + Math.random() * 0.5;
      return {
        x: (Math.random() - 0.5) * fieldSize,
        z: (Math.random() - 0.5) * fieldSize,
        scale: scale,
        height: 5 * scale, // Sync total height to scale multiplier perfectly
        rotY: Math.random() * Math.PI * 2,
      };
    })
  ), [count, fieldSize]);

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

      // ─────────────
      // UNIFIED TRUNK & BRANCHES
      // ─────────────
      dummy.position.set(0, 0, 0); // Geometry is already grounded internally via .translate!
      dummy.scale.setScalar(d.scale);
      dummy.rotation.set(0, d.rotY, 0);
      dummy.updateMatrix();
      trunkRef.current.setMatrixAt(i, dummy.matrix);

      // ─────────────
      // CANOPY
      // ─────────────
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