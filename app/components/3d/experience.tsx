"use client"
import { Grid, KeyboardControls, OrbitControls, ScrollControlsState } from '@react-three/drei';
import { Canvas } from '@react-three/fiber';
import { CuboidCollider, Physics, RapierRigidBody, RigidBody } from '@react-three/rapier';
import { useControls } from 'leva';
import * as THREE from 'three';
import { Vehicle } from './jeep/vehicle';
import { LeafSystem } from './plane';
import { WebGPURenderer } from 'three/webgpu';
import { useReducer, useRef } from 'react';
import { MobileControls } from '../MobileControls';
import { InfiniteGrass } from './environment/grass';
const spawn = {
	position: [0, 2, 0] as THREE.Vector3Tuple,
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





const Scene = () => {
	return (
		<>
			{/* Ground Collider */}
			<RigidBody type="fixed" colliders="cuboid">
				<CuboidCollider args={[500, 0.5, 500]} position={[0, -0.5, 0]} />
			</RigidBody>

			<gridHelper args={[100, 100, 0x444444, 0x222222]} />
		</>
	);
};
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
	const { debug, orbitControls } = useControls('physics', { debug: false, orbitControls: false });
	const chasisBodyRef = useRef<RapierRigidBody>(null!)
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
				<color attach="background" args={['#111']} />
				<Physics debug={debug} >
					<KeyboardControls map={controls}>
						<Vehicle position={spawn.position} rotation={spawn.rotation} chasisBodyRef={chasisBodyRef} mobileControls={mobileControls} />
					</KeyboardControls>
					<Scene />
				</Physics>
				<ambientLight intensity={0.5} />
				<directionalLight position={[10, 10, 5]} intensity={1} castShadow />
				{orbitControls && <OrbitControls makeDefault />}
				{/* <LeafSystem jeepRef={chasisBodyRef} /> */}
				<InfiniteGrass chasisBodyRef={chasisBodyRef} />
			</Canvas>

			<MobileControls onChange={setMobileControls} />
		</>
	);
}
