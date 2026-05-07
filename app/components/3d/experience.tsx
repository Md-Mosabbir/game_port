"use client"
import { KeyboardControls, OrbitControls } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { Physics, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

import { useEffect, useReducer, useRef, useState } from 'react';
import { MobileControls } from '../MobileControls';
import { InfiniteGrass } from './environment/grass';
import { Sky } from './environment/sky';
import { WorldGround } from './environment/world-ground';
import { WorldLighting } from './environment/world-lighting';
import { initializeWorldControls } from '@/app/controls';
import { GRASS_CONFIG } from '@/app/controls/grassControls';
import { ENV_CONFIG, subscribeToEnvConfig } from '@/app/controls/environmentControls';
import { WebGPURenderer } from 'three/webgpu';
import { Vehicle } from './environment/vehicle';
import { LeafSystem } from './plane';
const spawn = {
	position: [0, 10, 0] as THREE.Vector3Tuple,
	rotation: [0, 0, 0] as THREE.Vector3Tuple,
};

const controls = [
	{ name: 'forward', keys: ['ArrowUp', 'KeyW'] },
	{ name: 'back', keys: ['ArrowDown', 'KeyS'] },
	{ name: 'left', keys: ['ArrowLeft', 'KeyA'] },
	{ name: 'right', keys: ['ArrowRight', 'KeyD'] },
	{ name: 'brake', keys: ['Space'] },
	{ name: 'reset', keys: ['KeyR'] },
];
type ControlState = {
	forward: boolean; back: boolean
	left: boolean; right: boolean
	brake: boolean; reset: boolean
}

const initialControls: ControlState = {
	forward: false, back: false,
	left: false, right: false,
	brake: false, reset: false
}
export function Sketch() {
	const [mobileControls, setMobileControls] = useReducer(
		(_: ControlState, next: ControlState) => next,
		initialControls
	)
	
	const [envConfig, setEnvConfig] = useState(() => ({ ...ENV_CONFIG }));
	useEffect(() => {
		return subscribeToEnvConfig(() => {
			setEnvConfig({ ...ENV_CONFIG });
		});
	}, []);

	const chasisBodyRef = useRef<RapierRigidBody>(null!)
	useEffect(() => {
		initializeWorldControls();
	}, []);
	return (
		<>
			<Canvas
				shadows
				camera={{ fov: 45 }}
					gl={
					async (props) => {
						const r = new WebGPURenderer(props)
						return await r.init()
					}
				}
			>
				<Sky />
				<Physics debug={envConfig.physicsDebug} >
					<KeyboardControls map={controls}>
						<Vehicle position={spawn.position} rotation={spawn.rotation} chasisBodyRef={chasisBodyRef} mobileControls={mobileControls} />
					</KeyboardControls>
					<WorldGround />
		
				</Physics>
				<WorldLighting />
				{envConfig.orbitControls && <OrbitControls makeDefault />}
				<InfiniteGrass
					chasisBodyRef={chasisBodyRef}
					fieldSize={90}
				/>
			</Canvas>

			<MobileControls onChange={setMobileControls} />
		</>
	);
}
