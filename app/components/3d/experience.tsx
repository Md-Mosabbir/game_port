"use client"
import { KeyboardControls, OrbitControls, Stats, Html } from '@react-three/drei';
import { Canvas, useFrame } from '@react-three/fiber';
import { Physics, RapierRigidBody } from '@react-three/rapier';
import * as THREE from 'three';

import { useEffect, useReducer, useRef, useState } from 'react';
import { MobileControls } from '../MobileControls';
import { InfiniteGrass } from './environment/grass/grass';
import { Trees } from './environment/trees/trees';
import { Bushes } from './environment/bush/bushes';
import { Sky } from './environment/sky';
import { DayCycle } from './environment/day-cycle';
import { Water } from './environment/water';
import { Collectibles } from './environment/collectibles';
import { HUD } from '../HUD';
import { WorldGround } from './environment/world-ground';
import { WorldLighting } from './environment/world-lighting';
import { initializeWorldControls } from '@/app/controls';
import { ENV_CONFIG, subscribeToEnvConfig } from '@/app/controls/environmentControls';
import { FOLIAGE_CONFIG, subscribeToFoliageConfig } from '@/app/controls/foliageControls';
import { WebGPURenderer } from 'three/webgpu';
import { Vehicle } from './environment/vehicle';
import { ObstacleManager } from './environment/collision/obstacle';

const spawn = {
	// Y is clearance above the terrain, not an absolute height.
	position: [0, 2.5, 0] as THREE.Vector3Tuple,
	rotation: [0, 0, 0] as THREE.Vector3Tuple,
};

const controls = [
	{ name: 'forward', keys: ['ArrowUp', 'KeyW'] },
	{ name: 'back', keys: ['ArrowDown', 'KeyS'] },
	{ name: 'left', keys: ['ArrowLeft', 'KeyA'] },
	{ name: 'right', keys: ['ArrowRight', 'KeyD'] },
	{ name: 'brake', keys: ['Space'] },
	{ name: 'boost', keys: ['ShiftLeft', 'ShiftRight'] },
	{ name: 'reset', keys: ['KeyR'] },
];
type ControlState = {
	forward: boolean; back: boolean
	left: boolean; right: boolean
	brake: boolean; boost: boolean; reset: boolean
	axisX: number; axisY: number
}

const initialControls: ControlState = {
	forward: false, back: false,
	left: false, right: false,
	brake: false, boost: false, reset: false,
	axisX: 0, axisY: 0
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

	const [foliageConfig, setFoliageConfig] = useState(() => ({ ...FOLIAGE_CONFIG }));
	useEffect(() => {
		return subscribeToFoliageConfig(() => {
			setFoliageConfig({ ...FOLIAGE_CONFIG });
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

				<DayCycle />
				<Sky />
				<Stats />
	
				<Physics debug={envConfig.physicsDebug} >
					<KeyboardControls map={controls}>
						<Vehicle position={spawn.position} rotation={spawn.rotation} chasisBodyRef={chasisBodyRef} mobileControls={mobileControls} />
					</KeyboardControls>
					<WorldGround chasisBodyRef={chasisBodyRef} />
					<ObstacleManager carBodyRef={chasisBodyRef} />
				</Physics>
				<Water />
				<Collectibles carBodyRef={chasisBodyRef} />
				<WorldLighting />
				{envConfig.orbitControls && <OrbitControls makeDefault />}
				{envConfig.orbitControls && <gridHelper args={[100, 100, "#ff0000", "#00ff00"]} position={[0,0,0]} />}
	
				<InfiniteGrass
					chasisBodyRef={chasisBodyRef}
				/>

				<Bushes 
					count={foliageConfig.bushCount} 
					planeCount={foliageConfig.bushPlaneCount} 
					config={foliageConfig}                  
					chasisBodyRef={chasisBodyRef}
					fieldSize={foliageConfig.foliageFieldSize}
				/>
			
			
				<Trees 
					count={foliageConfig.treeCount} 
					planeCount={foliageConfig.treePlaneCount} 
					config={foliageConfig}
					chasisBodyRef={chasisBodyRef}
					fieldSize={foliageConfig.foliageFieldSize}
				/>
		
			</Canvas>

			<HUD />
			<MobileControls onChange={setMobileControls} />
		</>
	);
}
