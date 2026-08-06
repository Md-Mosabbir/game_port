import { useFrame } from '@react-three/fiber';
import { RapierRigidBody } from '@react-three/rapier';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { MeshBasicNodeMaterial } from 'three/webgpu';
import { color, mix, positionLocal, time, vec3 } from 'three/tsl';
import { getTerrainHeight } from '@/app/systems/terrain';
import { WATER_CONFIG } from '@/app/controls/waterControls';
import { GAME_STATE, addScore, announce } from '@/app/systems/game-state';

// Glowing rings scattered around the player. Drive through one to collect it,
// and it re-seeds somewhere else in the field — so the world never runs out.
const COUNT = 26;
const FIELD = 260;
const PICKUP_RADIUS = 3.2;
const HOVER = 1.8;

type Orb = { x: number; z: number; y: number; phase: number; alive: boolean };

const _matrix = new THREE.Matrix4();
const _quat = new THREE.Quaternion();
const _scale = new THREE.Vector3(1, 1, 1);
const _position = new THREE.Vector3();

// Place an orb on reachable ground: never underwater, never on a cliff.
const seedOrb = (centerX: number, centerZ: number, orb: Orb) => {
	for (let attempt = 0; attempt < 12; attempt++) {
		const x = centerX + (Math.random() - 0.5) * FIELD;
		const z = centerZ + (Math.random() - 0.5) * FIELD;
		const y = getTerrainHeight(x, z);

		if (y < WATER_CONFIG.level + 1.5) continue;

		// Reject steep ground by comparing nearby samples.
		const slope = Math.max(
			Math.abs(getTerrainHeight(x + 3, z) - y),
			Math.abs(getTerrainHeight(x, z + 3) - y)
		) / 3;
		if (slope > 0.5) continue;

		orb.x = x;
		orb.z = z;
		orb.y = y + HOVER;
		orb.phase = Math.random() * Math.PI * 2;
		orb.alive = true;
		return;
	}

	// Fell through every attempt (mountains, a lake) — park it out of the way
	// and let the next wrap try again.
	orb.alive = false;
};

export const Collectibles = ({ carBodyRef }: { carBodyRef?: React.RefObject<RapierRigidBody | null> }) => {
	const meshRef = useRef<THREE.InstancedMesh>(null!);

	const orbs = useMemo<Orb[]>(
		() => Array.from({ length: COUNT }, () => ({ x: 0, z: 0, y: 0, phase: 0, alive: false })),
		[]
	);

	const geometry = useMemo(() => new THREE.TorusGeometry(1.25, 0.22, 8, 20), []);

	const material = useMemo(() => {
		const m = new MeshBasicNodeMaterial({ transparent: true });
		// Pulsing two-tone glow so they read from a distance.
		const pulse = time.mul(2.2).sin().mul(0.5).add(0.5);
		const glow = mix(color('#ffd34d'), color('#ff7ae0'), positionLocal.y.mul(0.4).add(0.5));
		m.colorNode = vec3(glow).mul(pulse.mul(0.45).add(0.85));
		return m;
	}, []);

	useFrame((state, delta) => {
		const mesh = meshRef.current;
		const carPos = carBodyRef?.current?.translation();
		if (!mesh || !carPos) return;

		for (let i = 0; i < orbs.length; i++) {
			const orb = orbs[i];

			// Seed on first run, and re-seed anything the player has driven past.
			if (!orb.alive || Math.abs(orb.x - carPos.x) > FIELD * 0.7 || Math.abs(orb.z - carPos.z) > FIELD * 0.7) {
				seedOrb(carPos.x, carPos.z, orb);
			}

			const bob = Math.sin(state.clock.elapsedTime * 1.6 + orb.phase) * 0.3;
			const spin = state.clock.elapsedTime * 1.2 + orb.phase;

			// Collected?
			const dx = orb.x - carPos.x;
			const dy = orb.y + bob - carPos.y;
			const dz = orb.z - carPos.z;
			if (orb.alive && dx * dx + dy * dy + dz * dz < PICKUP_RADIUS * PICKUP_RADIUS) {
				GAME_STATE.collected += 1;
				addScore(100);
				announce('+100');
				seedOrb(carPos.x, carPos.z, orb);
				continue;
			}

			_position.set(orb.x, orb.y + bob, orb.z);
			_quat.setFromEuler(new THREE.Euler(Math.PI * 0.5, spin, 0));
			_scale.setScalar(orb.alive ? 1 : 0);
			_matrix.compose(_position, _quat, _scale);
			mesh.setMatrixAt(i, _matrix);
		}

		mesh.instanceMatrix.needsUpdate = true;
		void delta;
	});

	return <instancedMesh ref={meshRef} args={[geometry, material, COUNT]} frustumCulled={false} />;
};
