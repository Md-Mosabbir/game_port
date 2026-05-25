import { useMemo } from 'react';
import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/addons/utils/BufferGeometryUtils.js';

export function useStylizedBushGeometry(planeCount = 140, config = { bushRadius: 1.2 }) {
  return useMemo(() => {
    const geometries = [];
    const basePlane = new THREE.PlaneGeometry(1, 1);

    for (let i = 0; i < planeCount; i++) {
      // Create an individual plane instance
      const plane = basePlane.clone();

      // --- BRUNO'S POSITIONING MATH (Image 1) ---
      // Distributes highly concentrated elements near the absolute center
      const radiusFactor = 1 - Math.pow(Math.random(), 3);
      const r = radiusFactor * config.bushRadius;

      const spherical = new THREE.Spherical(
        r,
        Math.PI * 2 * Math.random(), // Phi
        Math.PI * Math.random()      // Theta
      );

      const position = new THREE.Vector3().setFromSpherical(spherical);

      // Randomize rotation wildly across all axes
      plane.rotateX(Math.random() * 9999);
      plane.rotateY(Math.random() * 9999);
      plane.rotateZ(Math.random() * 9999);

      // Translate plane to its calculated spherical layout spot
      plane.translate(position.x, position.y, position.z);

      // --- BRUNO'S NORMAL LERP MATH (Image 2) ---
      const normalTarget = position.clone().normalize();
      const normalArray = new Float32Array(12); // 4 vertices * 3 coordinates (x,y,z)

      // Loop over the 4 vertices of the individual PlaneGeometry
      for (let j = 0; j < 4; j++) {
        const i3 = j * 3;

        // Extract native vertex positions
        const vertexPos = new THREE.Vector3(
          plane.attributes.position.array[i3],
          plane.attributes.position.array[i3 + 1],
          plane.attributes.position.array[i3 + 2]
        );

        // Mix native face orientation with the global outward target vector
        const mixedNormal = vertexPos.lerp(normalTarget, 0.4);

        normalArray[i3] = mixedNormal.x;
        normalArray[i3 + 1] = mixedNormal.y;
        normalArray[i3 + 2] = mixedNormal.z;
      }

      plane.setAttribute('normal', new THREE.BufferAttribute(normalArray, 3));
      geometries.push(plane);
    }

    if (geometries.length === 0) return new THREE.BufferGeometry();

    // Merge into a high performance composite array buffer
    const mergedGeometry = BufferGeometryUtils.mergeGeometries(geometries);
    basePlane.dispose();

    return mergedGeometry;
  }, [planeCount, config.bushRadius]);
}
