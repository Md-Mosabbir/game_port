import { RefObject, useEffect, useMemo, useState } from 'react';
import * as THREE from 'three';
import { RapierRigidBody } from '@react-three/rapier';
import { ROAD_CONFIG } from '@/app/controls/roadControls';
import { getRoadCenterX } from './road-curve';
import { useFrame } from '@react-three/fiber';
import { createAsphaltMaterial } from './materials/asphalt-material';
import { useTexture } from '@react-three/drei';

type InfiniteRoadProps = {
	chasisBodyRef: RefObject<RapierRigidBody>;
};

const CHUNK_POOL = 5;

type ChunkData = {
	key: number;
	roadGeometry: THREE.TubeGeometry;
};

const buildChunk = (chunkIndex: number): ChunkData => {
	const zStart = chunkIndex * ROAD_CONFIG.chunkLength;
	const points: THREE.Vector3[] = [];
	const samples = 10;
	for (let i = 0; i <= samples; i++) {
		const t = i / samples;
		const z = zStart + t * ROAD_CONFIG.chunkLength;
		const x = getRoadCenterX(z, ROAD_CONFIG.curveStrength);
		points.push(new THREE.Vector3(x, 0.05, z));
	}

	const curve = new THREE.CatmullRomCurve3(points, false, 'catmullrom', 0.25);
	const roadGeometry = new THREE.TubeGeometry(curve, 80, ROAD_CONFIG.roadWidth * 0.5, 12, false);

	return { key: chunkIndex, roadGeometry };
};

export const InfiniteRoad = ({ chasisBodyRef }: InfiniteRoadProps) => {
	const [startChunk, setStartChunk] = useState(-1);

	useFrame(() => {
		const currentZ = chasisBodyRef.current?.translation().z ?? 0;
		const centerChunk = Math.floor(currentZ / ROAD_CONFIG.chunkLength);
		const nextStart = centerChunk - 1;
		if (nextStart !== startChunk) setStartChunk(nextStart);
	});

	// Initialize the procedural TSL material
	const { material, update } = useMemo(() => createAsphaltMaterial(ROAD_CONFIG), []);

	// Update material uniforms every frame to reflect Tweakpane changes
	useFrame(() => {
		update(ROAD_CONFIG);
	});

	const chunks = useMemo(() => {
		const next = Array.from({ length: CHUNK_POOL }, (_, i) => buildChunk(startChunk + i));
		return next;
	}, [startChunk]);

	useEffect(() => {
		return () => {
			for (const chunk of chunks) {
				chunk.roadGeometry.dispose();
			}
		};
	}, [chunks]);

	return (
		<group>
			{chunks.map((chunk) => (
				<mesh 
					key={chunk.key} 
					geometry={chunk.roadGeometry} 
					material={material}
					receiveShadow 
					castShadow 
					scale={[1, 0.05, 1]} 
				/>
			))}
		</group>
	);
};
