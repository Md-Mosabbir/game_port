import { useVehicleController, WheelInfo } from '@/app/hooks/use-vehicle-controller';
import { useKeyboardControls, useGLTF, Clone } from '@react-three/drei';
import { useFrame, useThree } from '@react-three/fiber';
import { CuboidCollider, type RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier';
import { useControls } from 'leva';
import { type RefObject, useRef, useState, useMemo } from 'react';
import * as THREE from 'three';

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

	// --- LEVA CONTROLS ---
	const { accelerateForce, brakeForce, steerAngle } = useControls('vehicle-settings', {
		accelerateForce: { value: 4, min: 0, max: 20 },
		brakeForce: { value: 0.1, min: 0, max: 1.0, step: 0.01 },
		steerAngle: { value: Math.PI / 8, min: 0, max: Math.PI / 4 },
	});

	// NEW: Wheel Positioning Debugger
	const wheelPos = useControls('wheel-offsets', {
		frontBack: { value: 0.93, min: 0.5, max: 2.5, step: 0.01, label: 'X (Front/Back)' },
		upDown: { value: -0.5, min: -1.5, max: 1.5, step: 0.01, label: 'Y (Up/Down)' },
		width: { value: 0.55, min: 0.2, max: 1.5, step: 0.01, label: 'Z (Width)' },
	});

	const cam = useControls('vehicle-camera', {
		offset: { value: { x: 5.0, y: 14.3, z: 10.3 }, step: 0.1 },
		targetOffset: { value: { x: 0.4, y: -1.0, z: 1.2 }, step: 0.1 },
		smoothing: { value: 0.01, min: 0.0001, max: 0.1, step: 0.001 },
	});

	// Dynamic Wheel Info based on Leva
	const wheelInfoBase: Omit<WheelInfo, 'position'> = {
		axleCs: new THREE.Vector3(0, 0, -1),
		suspensionRestLength: 0.15,
		suspensionStiffness: 40,
		maxSuspensionTravel: 0.3,
		sideFrictionStiffness: 3,
		frictionSlip: 2.0,
		radius: 0.305,
	};

	// Recalculate wheels array whenever Leva controls change
	const wheels = useMemo(() => [
		{ position: new THREE.Vector3(-wheelPos.frontBack, wheelPos.upDown, -wheelPos.width), ...wheelInfoBase },
		{ position: new THREE.Vector3(-wheelPos.frontBack, wheelPos.upDown, wheelPos.width), ...wheelInfoBase },
		{ position: new THREE.Vector3(wheelPos.frontBack, wheelPos.upDown, -wheelPos.width), ...wheelInfoBase },
		{ position: new THREE.Vector3(wheelPos.frontBack, wheelPos.upDown, wheelPos.width), ...wheelInfoBase },
	], [wheelPos]);

	const { vehicleController } = useVehicleController(chasisBodyRef, wheelsRef as RefObject<THREE.Object3D[]>, wheels);

	const [smoothedCameraPosition] = useState(new THREE.Vector3(0, 10, -20));
	const [smoothedCameraTarget] = useState(new THREE.Vector3());

	useFrame((state, delta) => {
		if (!chasisMeshRef.current || !vehicleController.current || !!threeControls) return;

		const t = 1.0 - cam.smoothing ** delta;
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
		const engineForce = (Number(merged.forward) - Number(merged.back)) * accelerateForce;
		controller.setWheelEngineForce(0, engineForce);
		controller.setWheelEngineForce(1, engineForce);

		const wheelBrake = Number(merged.brake) * brakeForce;
		[0, 1, 2, 3].forEach((i) => controller.setWheelBrake(i, wheelBrake));

		const currentSteering = controller.wheelSteering(0) || 0;
		const steerDirection = Number(merged.left) - Number(merged.right);
		const steering = THREE.MathUtils.lerp(currentSteering, steerAngle * steerDirection, 0.1);
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
		cameraPos.set(cam.offset.x, cam.offset.y, cam.offset.z);
		cameraPos.applyMatrix4(chasisMeshRef.current.matrixWorld);
		cameraPos.y = Math.max(cameraPos.y, chassisRigidBody.translation().y + 0.5);
		smoothedCameraPosition.lerp(cameraPos, t);
		state.camera.position.copy(smoothedCameraPosition);

		const bodyPos = chasisMeshRef.current.getWorldPosition(_bodyPosition);
		const cameraTarget = _cameraTarget;
		cameraTarget.copy(bodyPos).add(new THREE.Vector3(cam.targetOffset.x, cam.targetOffset.y, cam.targetOffset.z));
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
			<CuboidCollider args={[1.395, 0.805, 0.595]} />

			<group ref={chasisMeshRef}>
				<primitive object={chassisGltf.scene} castShadow rotation={[0, Math.PI, 0]} />

			</group>

			{wheels.map((wheel, index) => (
				<group key={index} ref={(ref) => (wheelsRef.current[index] = ref)} position={wheel.position}>
					<group
						// NUDGE CONTROLS: 
						// If the wheel is off-center, tweak these numbers (e.g., 0.02) 
						// to slide the model around the physics pivot point.
						position={[0, 0, 0]}

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
