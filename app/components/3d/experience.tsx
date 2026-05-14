"use client"
import { KeyboardControls, OrbitControls, Stats, Html } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

import { useEffect, useReducer, useRef, useState } from 'react';
import { MobileControls } from '../MobileControls';
import { InfiniteGrass } from './environment/grass/grass';
import { Sky } from './environment/sky';
import { WorldGround } from './environment/world-ground';
import { WorldLighting } from './environment/world-lighting';
import { initializeWorldControls } from '@/app/controls';

import { ENV_CONFIG, subscribeToEnvConfig } from '@/app/controls/environmentControls';
import { WebGPURenderer } from 'three/webgpu';
import { Vehicle } from './environment/vehicle';

const spawn = {
	position: [0, 1.5, 0] as THREE.Vector3Tuple,
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


function OriginMarker() {
    return (
        <group position={[0, 0, 0]}>
            {/* The Vertical Magenta Pillar you already had */}
            <mesh position={[0, 25, 0]}>
                <cylinderGeometry args={[0.1, 0.1, 50, 32]} />
                <meshStandardMaterial color="#ff00ff" emissive="#ff00ff" emissiveIntensity={2} />
            </mesh>

            {/* THICK AXIS BEAMS */}
            {/* X - Red */}
            <mesh rotation={[0, 0, Math.PI / 2]} position={[250, 0, 0]}>
                <cylinderGeometry args={[0.05, 0.05, 500]} />
                <meshBasicMaterial color="red" />
            </mesh>
            {/* Z - Blue */}
            <mesh rotation={[Math.PI / 2, 0, 0]} position={[0, 0, 250]}>
                <cylinderGeometry args={[0.05, 0.05, 500]} />
                <meshBasicMaterial color="blue" />
            </mesh>

            <mesh rotation={[Math.PI / 2, 0, 0]}>
                <ringGeometry args={[5, 6, 64]} />
                <meshBasicMaterial color="#ff00ff" side={THREE.DoubleSide} />
            </mesh>
        </group>
    );
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
				<OriginMarker />
				<Stats />
	
				<Physics debug={envConfig.physicsDebug} >
					<KeyboardControls map={controls}>
						<Vehicle position={spawn.position} rotation={spawn.rotation} chasisBodyRef={chasisBodyRef} mobileControls={mobileControls} />
					</KeyboardControls>
					<WorldGround />
		
				</Physics>
				<WorldLighting />
				{envConfig.orbitControls && <OrbitControls makeDefault />}
				{envConfig.orbitControls && <gridHelper args={[100, 100, "#ff0000", "#00ff00"]} position={[0,0,0]} />}
	
				<InfiniteGrass
					chasisBodyRef={chasisBodyRef}
				/>
		
			</Canvas>

			<MobileControls onChange={setMobileControls} />
		</>
	);
}
