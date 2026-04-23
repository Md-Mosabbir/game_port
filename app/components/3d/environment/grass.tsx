import * as THREE from 'three';
import { RefObject, useMemo, useRef } from 'react';
import { useEffect } from 'react';
import { RapierRigidBody } from '@react-three/rapier';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, float, max, mix, mod, positionLocal, uniform, vec3 } from 'three/tsl';
import { extend, useFrame } from '@react-three/fiber';

extend({ MeshBasicNodeMaterial });

type InfiniteGrassProps = {
	count?: number;
	fieldSize?: number;
	chasisBodyRef?: RefObject<RapierRigidBody>;
};

const _wheelOffsets = [
	new THREE.Vector3(-0.93, -0.5, -0.55),
	new THREE.Vector3(-0.93, -0.5, 0.55),
	new THREE.Vector3(0.93, -0.5, -0.55),
	new THREE.Vector3(0.93, -0.5, 0.55),
];

const _tmpQuat = new THREE.Quaternion();
const _tmpWheel = new THREE.Vector3();

export function InfiniteGrass({ count = 25000, fieldSize = 60, chasisBodyRef }: InfiniteGrassProps) {
	const HISTORY_SIZE = 128;
	const historyCursorRef = useRef(0);
	const historyDataRef = useRef<Float32Array | null>(null);
	const homesRef = useRef<Float32Array | null>(null);
	const flattenRef = useRef<Float32Array | null>(null);
	const flattenAttrRef = useRef<THREE.BufferAttribute | null>(null);
	const frameRef = useRef(0);

	const uniforms = useMemo(
		() => ({
			cameraXZ: uniform(new THREE.Vector2()),
			cameraRight: uniform(new THREE.Vector3(1, 0, 0)),
			fieldSize: uniform(fieldSize),
		}),
		[fieldSize]
	);

	const historyData = useMemo(() => new Float32Array(HISTORY_SIZE * 4), []);
	const grassData = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 9);
		const homes = new Float32Array(count * 9);
		const tipness = new Float32Array(count * 3);
		const flatten = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			const i9 = i * 9;
			const i3 = i * 3;
			const r0 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
			const r1 = ((Math.sin((i + 101) * 78.233) * 43758.5453) % 1 + 1) % 1;
			const r2 = ((Math.sin((i + 503) * 39.425) * 43758.5453) % 1 + 1) % 1;
			const r3 = ((Math.sin((i + 997) * 15.891) * 43758.5453) % 1 + 1) % 1;
			const homeX = (r0 - 0.5) * fieldSize;
			const homeZ = (r1 - 0.5) * fieldSize;
			const width = 0.05 + r2 * 0.08;
			const height = 0.5 + r3 * 0.9;

			positions[i9 + 0] = -width;
			positions[i9 + 1] = 0;
			positions[i9 + 2] = 0;
			positions[i9 + 3] = width;
			positions[i9 + 4] = 0;
			positions[i9 + 5] = 0;
			positions[i9 + 6] = 0;
			positions[i9 + 7] = height;
			positions[i9 + 8] = 0;

			for (let j = 0; j < 9; j += 3) {
				homes[i9 + j + 0] = homeX;
				homes[i9 + j + 1] = 0;
				homes[i9 + j + 2] = homeZ;
			}

			tipness[i3 + 0] = 0;
			tipness[i3 + 1] = 0;
			tipness[i3 + 2] = 1;
		}

		geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geo.setAttribute('aHome', new THREE.BufferAttribute(homes, 3));
		geo.setAttribute('aTipness', new THREE.BufferAttribute(tipness, 1));
		const flattenAttr = new THREE.BufferAttribute(flatten, 1);
		geo.setAttribute('aFlatten', flattenAttr);

		return { geometry: geo, homes, flatten, flattenAttr };
	}, [count, fieldSize]);

	const grassMaterial = useMemo(() => {
		const material = new MeshBasicNodeMaterial({ side: THREE.DoubleSide });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aHome = attribute('aHome', 'vec3') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aTipness = attribute('aTipness', 'float') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aFlatten = attribute('aFlatten', 'float') as any;

		const halfField = uniforms.fieldSize.mul(0.5);
		const wrappedX = mod(aHome.x.sub(uniforms.cameraXZ.x).add(halfField), uniforms.fieldSize)
			.sub(halfField)
			.add(uniforms.cameraXZ.x);
		const wrappedZ = mod(aHome.z.sub(uniforms.cameraXZ.y).add(halfField), uniforms.fieldSize)
			.sub(halfField)
			.add(uniforms.cameraXZ.y);

		const center = vec3(wrappedX, 0, wrappedZ);
		// Strong displacement: tracked areas flatten blades close to ground.

		const flattenScale = max(float(0.0), float(1.0).sub(aFlatten));
		const flattenedHeight = positionLocal.y.mul(flattenScale);
		const billboardOffset = uniforms.cameraRight.mul(positionLocal.x);
		material.positionNode = center.add(billboardOffset).add(vec3(0, flattenedHeight, 0));

		const base = vec3(0.07, 0.28, 0.08);
		const tip = vec3(0.28, 0.72, 0.20);
		material.colorNode = mix(base, tip, aTipness);

		return material;
	}, [uniforms]);

	useEffect(() => {
		historyDataRef.current = historyData;
		homesRef.current = grassData.homes;
		flattenRef.current = grassData.flatten;
		flattenAttrRef.current = grassData.flattenAttr;
	}, [grassData, historyData]);

	useFrame((state) => {
		uniforms.cameraXZ.value.set(state.camera.position.x, state.camera.position.z);
		state.camera.getWorldDirection(_tmpWheel);
		_tmpWheel.crossVectors(state.camera.up, _tmpWheel).normalize();
		uniforms.cameraRight.value.copy(_tmpWheel);

		if (!chasisBodyRef?.current) return;
		if (!historyDataRef.current || !homesRef.current || !flattenRef.current || !flattenAttrRef.current) return;

		const body = chasisBodyRef.current;
		const translation = body.translation();
		const rotation = body.rotation();
		_tmpQuat.set(rotation.x, rotation.y, rotation.z, rotation.w);

		for (const offset of _wheelOffsets) {
			_tmpWheel.copy(offset).applyQuaternion(_tmpQuat);
			const writeIndex = historyCursorRef.current % HISTORY_SIZE;
			const base = writeIndex * 4;
			historyDataRef.current[base + 0] = translation.x + _tmpWheel.x;
			historyDataRef.current[base + 1] = translation.z + _tmpWheel.z;
			historyDataRef.current[base + 2] = 0;
			historyDataRef.current[base + 3] = 1;
			historyCursorRef.current += 1;
		}

		frameRef.current += 1;
		if (frameRef.current % 2 !== 0) return;

		const homes = homesRef.current;
		const flatten = flattenRef.current;
		const half = fieldSize * 0.5;
		const cameraX = state.camera.position.x;
		const cameraZ = state.camera.position.z;
		const trackRadius = 0.95;
		const invRadiusSq = 1 / (trackRadius * trackRadius);
		const maxSamples = Math.min(HISTORY_SIZE, historyCursorRef.current);

		for (let i = 0; i < count; i++) {
			const i9 = i * 9;
			const i3 = i * 3;
			const wrappedX = ((((homes[i9 + 0] - cameraX + half) % fieldSize) + fieldSize) % fieldSize) - half + cameraX;
			const wrappedZ = ((((homes[i9 + 2] - cameraZ + half) % fieldSize) + fieldSize) % fieldSize) - half + cameraZ;

			let flattenStrength = flatten[i3] * 0.96;
			for (let j = 0; j < maxSamples; j++) {
				const base = j * 4;
				if (historyDataRef.current[base + 3] < 0.5) continue;
				const dx = wrappedX - historyDataRef.current[base + 0];
				const dz = wrappedZ - historyDataRef.current[base + 1];
				const d2 = dx * dx + dz * dz;
				const influence = Math.exp(-d2 * invRadiusSq);
				if (influence > flattenStrength) flattenStrength = influence;
			}

			flatten[i3 + 0] = flattenStrength;
			flatten[i3 + 1] = flattenStrength;
			flatten[i3 + 2] = flattenStrength;
		}

		flattenAttrRef.current.needsUpdate = true;
	});

	return <mesh geometry={grassData.geometry} material={grassMaterial} frustumCulled={false} />;
}
