"use client";
import * as THREE from 'three';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { RigidBody, RapierRigidBody } from '@react-three/rapier';
import { GRASS_SETTINGS } from '../grass/grass-config';

// ─── Obstacle Definition & Config ─────────────────────────────────────────────

export interface ObstacleConfig {
	id: string;
	type: 'rock' | 'sphere';
	basePosition: THREE.Vector3;
	scale: THREE.Vector3;
	rotation: THREE.Euler;
	color: string;
	roughness: number;
	metalness: number;
	isDynamic: boolean;
	mass: number;
}

// Deterministic pseudo-random from a seed
function rnd(seed: number) {
	const x = Math.sin(seed) * 10000;
	return x - Math.floor(x);
}

// ─── Single Obstacle ──────────────────────────────────────────────────────────

interface ObstacleInstanceProps {
	config: ObstacleConfig;
	carBodyRef?: React.MutableRefObject<RapierRigidBody>;
}

function ObstacleInstance({ config, carBodyRef }: ObstacleInstanceProps) {
	const rigidBodyRef = useRef<RapierRigidBody>(null!);

	const material = useMemo(() => new THREE.MeshStandardMaterial({
		color: new THREE.Color(config.color),
		roughness: config.roughness,
		metalness: config.metalness,
	}), [config.color, config.roughness, config.metalness]);

	const geometry = useMemo(() => {
		if (config.type === 'rock') {
			// Low-poly icosahedron for a craggy rock feel
			return new THREE.IcosahedronGeometry(1.0, 1);
		}
		return new THREE.SphereGeometry(1.0, 16, 16);
	}, [config.type]);

	// ── Infinite-field wrapping ───────────────────────────────────────────────
	useFrame(() => {
		if (!rigidBodyRef.current || !carBodyRef?.current) return;

		const body  = rigidBodyRef.current;
		const carT  = carBodyRef.current.translation();
		const bodyT = body.translation();

		const half = GRASS_SETTINGS.FIELD_SIZE / 2;
		const nx   = bodyT.x;
		const ny   = bodyT.y;
		const nz   = bodyT.z;

		let dx = bodyT.x - carT.x;
		let dz = bodyT.z - carT.z;
		let wrapped = false;

		let newX = nx, newZ = nz;
		if (dx < -half) { newX += GRASS_SETTINGS.FIELD_SIZE; wrapped = true; }
		else if (dx > half) { newX -= GRASS_SETTINGS.FIELD_SIZE; wrapped = true; }
		if (dz < -half) { newZ += GRASS_SETTINGS.FIELD_SIZE; wrapped = true; }
		else if (dz > half) { newZ -= GRASS_SETTINGS.FIELD_SIZE; wrapped = true; }

		if (wrapped) {
			body.setTranslation({ x: newX, y: ny, z: newZ }, true);
			if (config.isDynamic) {
				body.setLinvel({ x: 0, y: 0, z: 0 }, true);
				body.setAngvel({ x: 0, y: 0, z: 0 }, true);
			}
		}
	});

	return (
		<RigidBody
			ref={rigidBodyRef}
			type={config.isDynamic ? 'dynamic' : 'fixed'}
			position={[config.basePosition.x, config.basePosition.y, config.basePosition.z]}
			rotation={[config.rotation.x, config.rotation.y, config.rotation.z]}
			mass={config.mass}
			colliders={config.type === 'sphere' ? 'ball' : 'hull'}
			restitution={0.35}
			friction={0.9}
		>
			<mesh
				geometry={geometry}
				material={material}
				scale={[config.scale.x, config.scale.y, config.scale.z]}
				castShadow
				receiveShadow
			/>
		</RigidBody>
	);
}

// ─── Obstacles Manager ────────────────────────────────────────────────────────

interface ObstacleManagerProps {
	carBodyRef?: React.MutableRefObject<RapierRigidBody>;
	/** Total number of obstacles to scatter. Default: 30 */
	count?: number;
}

export function ObstacleManager({ carBodyRef, count = 30 }: ObstacleManagerProps) {
	const obstacles = useMemo<ObstacleConfig[]>(() => {
		const list: ObstacleConfig[] = [];
		const F = GRASS_SETTINGS.FIELD_SIZE;

		for (let i = 0; i < count; i++) {
			const s = i * 137.508; // golden-angle seed spread

			const isRock    = rnd(s + 1) > 0.35; // 65% rocks, 35% spheres
			const isDynamic = !isRock;             // spheres roll, rocks stay

			const posX = (rnd(s + 2) - 0.5) * F;
			const posZ = (rnd(s + 3) - 0.5) * F;

			// rocks sit half-embedded in the ground, spheres sit on top
			const r3     = rnd(s + 4);
			const scaleX = isRock ? 0.6 + r3 * 1.8 : 0.5 + rnd(s + 5) * 1.2;
			const scaleY = isRock ? 0.5 + rnd(s + 6) * 1.5 : scaleX; // spheres uniform
			const scaleZ = isRock ? 0.6 + rnd(s + 7) * 1.8 : scaleX;
			const posY   = isRock ? scaleY * 0.3 : scaleX;            // sit on ground

			// Warm off-white/stone palette
			const stoneHue = 0.06 + rnd(s + 8) * 0.06;
			const stoneLit = 0.82 + rnd(s + 9) * 0.15;
			const color    = new THREE.Color().setHSL(stoneHue, 0.1, stoneLit).getHexString();

			list.push({
				id:          `obs_${i}`,
				type:        isRock ? 'rock' : 'sphere',
				basePosition: new THREE.Vector3(posX, posY, posZ),
				scale:        new THREE.Vector3(scaleX, scaleY, scaleZ),
				rotation:     new THREE.Euler(
					isRock ? rnd(s + 10) * Math.PI       : 0,
					rnd(s + 11) * Math.PI * 2,
					isRock ? (rnd(s + 12) - 0.5) * 0.4  : 0,
				),
				color:     `#${color}`,
				roughness: 0.75 + rnd(s + 13) * 0.2,
				metalness: 0.0,
				isDynamic,
				mass:      isDynamic ? scaleX * 8 : 500,
			});
		}
		return list;
	}, [count]);

	return (
		<group name="obstacle-manager">
			{obstacles.map(obs => (
				<ObstacleInstance key={obs.id} config={obs} carBodyRef={carBodyRef} />
			))}
		</group>
	);
}
