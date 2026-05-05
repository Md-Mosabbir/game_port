// THREE.MathUtils.smoothstep creates smooth interpolation between 0 and 1.
// Docs: https://threejs.org/docs/#api/en/math/MathUtils.smoothstep
import * as THREE from 'three';

const hash1 = (n: number) => {
	const x = Math.sin(n * 127.1) * 43758.5453123;
	return x - Math.floor(x);
};

export const getRoadCenterX = (z: number, curveStrength: number) => {
	const segmentSize = 42;
	const scaled = z / segmentSize;
	const i0 = Math.floor(scaled);
	const t = scaled - i0;
	const a = hash1(i0) * 2 - 1;
	const b = hash1(i0 + 1) * 2 - 1;
	const smoothT = THREE.MathUtils.smoothstep(t, 0, 1);
	return THREE.MathUtils.lerp(a, b, smoothT) * curveStrength;
};
