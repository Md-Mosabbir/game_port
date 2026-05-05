import { useVehicleController, WheelInfo } from '@/app/hooks/use-vehicle-controller';
import { CAMERA_CONFIG } from '@/app/controls/cameraControls';
import { useKeyboardControls, useGLTF, Clone } from '@react-three/drei';
import { useFrame, useThree, Vector3 } from '@react-three/fiber';
import { CuboidCollider, type RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier';
import { type RefObject, useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { JEEP_CONFIG, subscribeToJeepConfig } from '@/app/controls/jeepControls';

type KeyControls = {
	forward: boolean;
	back: boolean;
	left: boolean;
	right: boolean;
	brake: boolean;
	reset: boolean;
};

type VehicleProps = {
	position: THREE.Vector3Tuple
	rotation: THREE.Vector3Tuple
	chasisBodyRef: RefObject<RapierRigidBody>
	mobileControls: MobileControlState
}
type MobileControlState = {
	forward: boolean
	back: boolean
	left: boolean
	right: boolean
	brake: boolean
	reset: boolean
}

const _bodyPosition = new THREE.Vector3();
const _cameraPosition = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();

export const Vehicle = ({ position, rotation, chasisBodyRef, mobileControls }: VehicleProps) => {
	const chassisGltf = useGLTF('/car_chassis.glb');
	const wheelGltf = useGLTF('/car_wheel.glb');

	const { rapier } = useRapier();
	const threeControls = useThree((s) => s.controls);
	const [, getKeyboardControls] = useKeyboardControls<keyof KeyControls>();

	const chasisMeshRef = useRef<THREE.Group>(null!);
	const wheelsRef: RefObject<(THREE.Object3D | null)[]> = useRef([]);

	// --- TWEAKPANE CONTROLS ---
	const [config, setConfig] = useState(() => ({ ...JEEP_CONFIG }));

	useEffect(() => {
		return subscribeToJeepConfig(() => {
			setConfig({ ...JEEP_CONFIG });
		});
	}, []);

	// Dynamic Wheel Info based on Tweakpane config
	const wheelInfoBase: Omit<WheelInfo, 'position'> = useMemo(() => ({
		axleCs: new THREE.Vector3(0, 0, -1),
		suspensionRestLength: 0.15 * config.scaleJeep,
		suspensionStiffness: 40,
		maxSuspensionTravel: 0.3 * config.scaleJeep,
		sideFrictionStiffness: 3,
		frictionSlip: 2.0,
		radius: 0.305 * config.scaleWheel * config.scaleJeep,
	}), [config.scaleJeep, config.scaleWheel]);

	// Recalculate wheels array whenever Tweakpane controls change
	const wheels = useMemo(() => [
		{ position: new THREE.Vector3(-config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, -config.width * config.scaleJeep), ...wheelInfoBase },
		{ position: new THREE.Vector3(-config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, config.width * config.scaleJeep), ...wheelInfoBase },
		{ position: new THREE.Vector3(config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, -config.width * config.scaleJeep), ...wheelInfoBase },
		{ position: new THREE.Vector3(config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, config.width * config.scaleJeep), ...wheelInfoBase },
	], [wheelInfoBase, config.frontBack, config.upDown, config.width, config.scaleJeep]);

	const { vehicleController } = useVehicleController(chasisBodyRef, wheelsRef as RefObject<THREE.Object3D[]>, wheels);

	const [smoothedCameraPosition] = useState(new THREE.Vector3(0, 10, -20));
	const [smoothedCameraTarget] = useState(new THREE.Vector3());
	
	useFrame((state, delta) => {
		if (!chasisMeshRef.current || !vehicleController.current || !!threeControls) return;

		const t = 1.0 - (1 - CAMERA_CONFIG.lerpSpeed) ** (delta * 60);
		const controller = vehicleController.current;
	
		const chassisRigidBody = controller.chassis();
		const controls = getKeyboardControls();
		const merged = {
			forward: controls.forward || mobileControls.forward,
			back: controls.back || mobileControls.back,
			left: controls.left || mobileControls.left,
			right: controls.right || mobileControls.right,
			brake: controls.brake || mobileControls.brake,
			reset: controls.reset || mobileControls.reset,
		}
		const engineForce = (Number(merged.forward) - Number(merged.back)) * config.accelerateForce;
		controller.setWheelEngineForce(0, engineForce);
		controller.setWheelEngineForce(1, engineForce);

		const wheelBrake = Number(merged.brake) * config.brakeForce;
		[0, 1, 2, 3].forEach((i) => controller.setWheelBrake(i, wheelBrake));

		const currentSteering = controller.wheelSteering(0) || 0;
		const steerDirection = Number(merged.left) - Number(merged.right);
		const steering = THREE.MathUtils.lerp(currentSteering, config.steerAngle * steerDirection, 0.1);
		controller.setWheelSteering(0, steering);
		controller.setWheelSteering(1, steering);

		if (merged.reset) {
			chassisRigidBody.setTranslation(new rapier.Vector3(...position), true);
			chassisRigidBody.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), true);
			chassisRigidBody.setLinvel(new rapier.Vector3(0, 0, 0), true);
			chassisRigidBody.setAngvel(new rapier.Vector3(0, 0, 0), true);
		}

		// Camera
		const cameraPos = _cameraPosition;
		cameraPos.set(CAMERA_CONFIG.offsetX, CAMERA_CONFIG.offsetY, CAMERA_CONFIG.offsetZ);
		cameraPos.applyMatrix4(chasisMeshRef.current.matrixWorld);
		cameraPos.y = Math.max(cameraPos.y, chassisRigidBody.translation().y + 0.5);
		// Vector3.lerp moves from current value toward target by a blend factor [0..1].
		// Docs: https://threejs.org/docs/#api/en/math/Vector3.lerp
		smoothedCameraPosition.lerp(cameraPos, t);
		state.camera.position.copy(smoothedCameraPosition);

		const bodyPos = chasisMeshRef.current.getWorldPosition(_bodyPosition);
		const cameraTarget = _cameraTarget;
		cameraTarget.copy(bodyPos);
		cameraTarget.y += 0.8;
		smoothedCameraTarget.lerp(cameraTarget, t);
		state.camera.lookAt(smoothedCameraTarget);
	});

	return (
		<RigidBody
			ref={chasisBodyRef}
			colliders={false}
			position={position}
			rotation={rotation}
			mass={1200}
			canSleep={false}
		
		>
			<CuboidCollider args={[1.395 * config.scaleJeep, 0.805 * config.scaleJeep, 0.595 * config.scaleJeep]} />

			<group ref={chasisMeshRef} scale={config.scaleJeep}>
				<group position={[config.chassisOffsetX, config.chassisOffsetY, config.chassisOffsetZ]}>
					<primitive object={chassisGltf.scene} castShadow rotation={[0, Math.PI, 0]} />
				</group>
			</group>

			{wheels.map((wheel, index) => (
				<group key={index} scale={config.scaleWheel * config.scaleJeep} ref={(ref) => (wheelsRef.current[index] = ref)} position={wheel.position}>
					{config.showDebugHelpers && (
						<group>
							<mesh>
								<sphereGeometry args={[0.08, 8, 8]} />
								<meshBasicMaterial color="#ff0000" wireframe />
							</mesh>
							<axesHelper args={[0.3]} />
						</group>
					)}
					<group
						// NUDGE CONTROLS: 
						// Slides the visual model around the physics pivot point.
						position={[config.wheelOffsetX, config.wheelOffsetY, config.wheelOffsetZ]}
					>
						<Clone object={wheelGltf.scene} castShadow />
					</group>
				</group>
			))}
		</RigidBody>
	);
};

useGLTF.preload('/car_chassis.glb');
useGLTF.preload('/car_wheel.glb');
