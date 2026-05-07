import * as THREE from 'three';
import { RefObject, useMemo, useRef, useState } from 'react';
import { useEffect } from 'react';
import { RapierRigidBody } from '@react-three/rapier';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { attribute, float, max, mix, mod, positionLocal, sin, time, uniform, vec3 } from 'three/tsl';
import { extend, useFrame } from '@react-three/fiber';
import { GRASS_CONFIG, subscribeToGrassConfig } from '@/app/controls/grassControls';
import { ROAD_CONFIG } from '@/app/controls/roadControls';
import { getRoadCenterX } from './road-curve';

extend({ MeshBasicNodeMaterial });
// this is the grass component for the infinite grass field
type InfiniteGrassProps = {
	fieldSize?: number;
	chasisBodyRef?: RefObject<RapierRigidBody>;
};
// this is the wheel offsets for the grass blades
const _wheelOffsets = [
	new THREE.Vector3(-0.93, -0.5, -0.55),
	new THREE.Vector3(-0.93, -0.5, 0.55),
	new THREE.Vector3(0.93, -0.5, -0.55),
	new THREE.Vector3(0.93, -0.5, 0.55),
];

const _tmpQuat = new THREE.Quaternion();
const _tmpWheel = new THREE.Vector3();

export function InfiniteGrass({ fieldSize = 90, chasisBodyRef }: InfiniteGrassProps) {
	const HISTORY_SIZE = 128;
	const historyCursorRef = useRef(0);
	const historyDataRef = useRef<Float32Array | null>(null);
	const clusterCentersRef = useRef<Float32Array | null>(null);
	const bladeOffsetsRef = useRef<Float32Array | null>(null);
	const flattenRef = useRef<Float32Array | null>(null);
	const flattenAttrRef = useRef<THREE.BufferAttribute | null>(null);
	const frameRef = useRef(0);

	const [config, setConfig] = useState(() => ({ ...GRASS_CONFIG }));
	useEffect(() => {
		return subscribeToGrassConfig(() => {
			setConfig({ ...GRASS_CONFIG });
		});
	}, []);
	const count = config.clusterCount * config.bladesPerCluster;

	const uniforms = useMemo(
		() => ({
			cameraXZ: uniform(new THREE.Vector2()),
			cameraRight: uniform(new THREE.Vector3(1, 0, 0)),
			fieldSize: uniform(fieldSize),
			windStrength: uniform(config.waveStrength),
			windFrequency: uniform(0.24),
			windSpeed: uniform(config.waveSpeed),
			colorBase: uniform(new THREE.Color(config.colorBase)),
			colorTip: uniform(new THREE.Color(config.colorTip)),
		}),
		[fieldSize, config.waveStrength, config.waveSpeed, config.colorBase, config.colorTip]
	);

	const historyData = useMemo(() => new Float32Array(HISTORY_SIZE * 4), []);
	const grassData = useMemo(() => {
		const geo = new THREE.BufferGeometry();
		const positions = new Float32Array(count * 9);
		const clusterCenters = new Float32Array(count * 9);
		const bladeOffsets = new Float32Array(count * 9);
		const tipness = new Float32Array(count * 3);
		const flatten = new Float32Array(count * 3);
		const phases = new Float32Array(count * 3);

		for (let i = 0; i < count; i++) {
			const i9 = i * 9;
			const i3 = i * 3;
			const r0 = ((Math.sin(i * 12.9898) * 43758.5453) % 1 + 1) % 1;
			const r1 = ((Math.sin((i + 101) * 78.233) * 43758.5453) % 1 + 1) % 1;
			const r2 = ((Math.sin((i + 503) * 39.425) * 43758.5453) % 1 + 1) % 1;
			const r3 = ((Math.sin((i + 997) * 15.891) * 43758.5453) % 1 + 1) % 1;

			const clusterIndex = i % config.clusterCount;
			const cR0 = ((Math.sin((clusterIndex + 73) * 21.97) * 43758.5453) % 1 + 1) % 1;
			const cR1 = ((Math.sin((clusterIndex + 311) * 56.11) * 43758.5453) % 1 + 1) % 1;
			const centerX = (cR0 - 0.5) * fieldSize;
			const centerZ = (cR1 - 0.5) * fieldSize;
			const angle = r0 * Math.PI * 2;
			const radius = Math.sqrt(r1) * config.clusterSpread;
			let absoluteX = centerX + Math.cos(angle) * radius;
			let absoluteZ = centerZ + Math.sin(angle) * radius;
			absoluteX = THREE.MathUtils.clamp(absoluteX, -fieldSize * 0.5, fieldSize * 0.5);
			absoluteZ = THREE.MathUtils.clamp(absoluteZ, -fieldSize * 0.5, fieldSize * 0.5);
			
			const roadCenterX = getRoadCenterX(absoluteZ, ROAD_CONFIG.curveStrength);
			const roadBuffer = ROAD_CONFIG.roadWidth * 0.5 + 4;
			if (Math.abs(absoluteX - roadCenterX) < roadBuffer) {
				absoluteX += (absoluteX < roadCenterX ? -1 : 1) * roadBuffer;
			}
			
			const finalOffsetX = absoluteX - centerX;
			const finalOffsetZ = absoluteZ - centerZ;

			const width = 0.05 + r2 * 0.08;
			const patchNoise = Math.sin(absoluteX * 0.18) * Math.cos(absoluteZ * 0.14) * 0.5 + 0.5;
			const height = 0.8 + r3 * 0.9 + patchNoise * 0.8;

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
				clusterCenters[i9 + j + 0] = centerX;
				clusterCenters[i9 + j + 1] = 0;
				clusterCenters[i9 + j + 2] = centerZ;
				
				bladeOffsets[i9 + j + 0] = finalOffsetX;
				bladeOffsets[i9 + j + 1] = 0;
				bladeOffsets[i9 + j + 2] = finalOffsetZ;
			}

			tipness[i3 + 0] = 0;
			tipness[i3 + 1] = 0;
			tipness[i3 + 2] = 1;

			const phase = r2 * Math.PI * 2.0;
			phases[i3 + 0] = phase;
			phases[i3 + 1] = phase;
			phases[i3 + 2] = phase;
		}

		geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geo.setAttribute('aClusterCenter', new THREE.BufferAttribute(clusterCenters, 3));
		geo.setAttribute('aBladeOffset', new THREE.BufferAttribute(bladeOffsets, 3));
		geo.setAttribute('aTipness', new THREE.BufferAttribute(tipness, 1));
		geo.setAttribute('aPhase', new THREE.BufferAttribute(phases, 1));
		const flattenAttr = new THREE.BufferAttribute(flatten, 1);
		geo.setAttribute('aFlatten', flattenAttr);

		return { geometry: geo, clusterCenters, bladeOffsets, flatten, flattenAttr };
	}, [count, fieldSize, config.clusterCount, config.clusterSpread]);

	const grassMaterial = useMemo(() => {
		const material = new MeshBasicNodeMaterial({ side: THREE.DoubleSide });

		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aClusterCenter = attribute('aClusterCenter', 'vec3') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aBladeOffset = attribute('aBladeOffset', 'vec3') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aTipness = attribute('aTipness', 'float') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aFlatten = attribute('aFlatten', 'float') as any;
		// eslint-disable-next-line @typescript-eslint/no-explicit-any
		const aPhase = attribute('aPhase', 'float') as any;

		const halfField = uniforms.fieldSize.mul(0.5);
		const wrappedCenterX = mod(aClusterCenter.x.sub(uniforms.cameraXZ.x).add(halfField), uniforms.fieldSize)
			.sub(halfField)
			.add(uniforms.cameraXZ.x);
		const wrappedCenterZ = mod(aClusterCenter.z.sub(uniforms.cameraXZ.y).add(halfField), uniforms.fieldSize)
			.sub(halfField)
			.add(uniforms.cameraXZ.y);

		const center = vec3(wrappedCenterX, 0, wrappedCenterZ).add(aBladeOffset);
		// Track deformation lowers blade height where tires passed.

		const flattenScale = max(float(0.0), float(1.0).sub(aFlatten));
		const flattenedHeight = positionLocal.y.mul(flattenScale);
		const billboardOffset = uniforms.cameraRight.mul(positionLocal.x);

		// Wind bends tips more than roots for natural motion.
		const windTime = time.mul(uniforms.windSpeed);
		const windWave = sin(
			windTime
				.add(center.x.mul(uniforms.windFrequency))
				.add(center.z.mul(uniforms.windFrequency.mul(1.31)))
				.add(aPhase)
		);
		const windBend = windWave
			.mul(uniforms.windStrength)
			.mul(aTipness)
			.mul(flattenScale);

		material.positionNode = center
			.add(billboardOffset)
			.add(vec3(windBend, flattenedHeight, windBend.mul(0.5)));

		// More saturated color ramp for a vibrant field.
		material.colorNode = mix(uniforms.colorBase, uniforms.colorTip, aTipness);

		return material;
	}, [uniforms]);

	useEffect(() => {
		historyDataRef.current = historyData;
		clusterCentersRef.current = grassData.clusterCenters;
		bladeOffsetsRef.current = grassData.bladeOffsets;
		flattenRef.current = grassData.flatten;
		flattenAttrRef.current = grassData.flattenAttr;
	}, [grassData, historyData]);

	useFrame((state) => {
		uniforms.cameraXZ.value.set(state.camera.position.x, state.camera.position.z);
		state.camera.getWorldDirection(_tmpWheel);
		_tmpWheel.crossVectors(state.camera.up, _tmpWheel).normalize();
		uniforms.cameraRight.value.copy(_tmpWheel);

		if (!chasisBodyRef?.current) return;
		if (!historyDataRef.current || !clusterCentersRef.current || !bladeOffsetsRef.current || !flattenRef.current || !flattenAttrRef.current) return;

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

		// Update deformation every 3rd frame to reduce CPU work.
		frameRef.current += 1;
		if (frameRef.current % 3 !== 0) return;

		const clusterCenters = clusterCentersRef.current;
		const bladeOffsets = bladeOffsetsRef.current;
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
			const wrappedCenterX = ((((clusterCenters[i9 + 0] - cameraX + half) % fieldSize) + fieldSize) % fieldSize) - half + cameraX;
			const wrappedCenterZ = ((((clusterCenters[i9 + 2] - cameraZ + half) % fieldSize) + fieldSize) % fieldSize) - half + cameraZ;
			
			const wrappedBladeX = wrappedCenterX + bladeOffsets[i9 + 0];
			const wrappedBladeZ = wrappedCenterZ + bladeOffsets[i9 + 2];

			let flattenStrength = flatten[i3] * 0.96;
			for (let j = 0; j < maxSamples; j++) {
				const base = j * 4;
				if (historyDataRef.current[base + 3] < 0.5) continue;
				const dx = wrappedBladeX - historyDataRef.current[base + 0];
				const dz = wrappedBladeZ - historyDataRef.current[base + 1];
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
