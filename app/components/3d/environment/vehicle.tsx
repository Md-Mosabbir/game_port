import { useVehicleController, WheelInfo } from '@/app/hooks/use-vehicle-controller';
import { CAMERA_CONFIG } from '@/app/controls/cameraControls';
import { useKeyboardControls, useGLTF, Clone } from '@react-three/drei';
import { useFrame, useThree, Vector3 } from '@react-three/fiber';
import { CuboidCollider, type RapierRigidBody, RigidBody, useRapier } from '@react-three/rapier';
import { type RefObject, useRef, useState, useMemo, useEffect } from 'react';
import * as THREE from 'three';
import { JEEP_CONFIG, subscribeToJeepConfig } from '@/app/controls/jeepControls';
import { getSpawnHeight, getTerrainHeight } from '@/app/systems/terrain';
import { WATER_CONFIG } from '@/app/controls/waterControls';
import { GAME_STATE, addScore, announce } from '@/app/systems/game-state';

type KeyControls = {
	forward: boolean;
	back: boolean;
	left: boolean;
	right: boolean;
	brake: boolean;
	boost: boolean;
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
	boost: boolean
	reset: boolean
	axisX: number
	axisY: number
}

const _bodyPosition = new THREE.Vector3();
const _cameraPosition = new THREE.Vector3();
const _cameraTarget = new THREE.Vector3();
const _worldUp = new THREE.Vector3(0, 1, 0);
const _uprightAxis = new THREE.Vector3();

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
		suspensionRestLength: config.suspensionRestLength * config.scaleJeep,
		suspensionStiffness: config.suspensionStiffness,
		maxSuspensionTravel: config.maxSuspensionTravel * config.scaleJeep,
		suspensionCompression: config.suspensionCompression,
		suspensionRelaxation: config.suspensionRelaxation,
		sideFrictionStiffness: config.sideFrictionStiffness,
		frictionSlip: config.frictionSlip,
		radius: 0.305 * config.scaleWheel * config.scaleJeep,
	}), [
		config.scaleJeep, config.scaleWheel, config.frictionSlip, config.sideFrictionStiffness,
		config.suspensionRestLength, config.suspensionStiffness, config.maxSuspensionTravel,
		config.suspensionCompression, config.suspensionRelaxation,
	]);

	// Recalculate wheels array whenever Tweakpane controls change
	const wheels = useMemo(() => [
		{ position: new THREE.Vector3(-config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, -config.width * config.scaleJeep), ...wheelInfoBase },
		{ position: new THREE.Vector3(-config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, config.width * config.scaleJeep), ...wheelInfoBase },
		{ position: new THREE.Vector3(config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, -config.width * config.scaleJeep), ...wheelInfoBase },
		{ position: new THREE.Vector3(config.frontBack * config.scaleJeep, config.upDown * config.scaleJeep, config.width * config.scaleJeep), ...wheelInfoBase },
	], [wheelInfoBase, config.frontBack, config.upDown, config.width, config.scaleJeep]);

	const { vehicleController } = useVehicleController(chasisBodyRef, wheelsRef as RefObject<THREE.Object3D[]>, wheels);

	// `position[1]` is treated as clearance above the ground, not an absolute
	// height — the terrain decides the rest.
	const spawnPosition = useMemo<THREE.Vector3Tuple>(
		() => [position[0], getSpawnHeight(position[0], position[2]) + position[1], position[2]],
		[position]
	);

	const [smoothedCameraPosition] = useState(new THREE.Vector3(0, 10, -20));
	const [smoothedCameraTarget] = useState(new THREE.Vector3());

	// Mass properties live on the collider, and @react-three/rapier only reads
	// them when the collider is created — so apply them imperatively to keep the
	// Tweakpane sliders live. Driven from the frame loop rather than an effect so
	// it still lands if the collider is not built yet on the first pass.
	const appliedMassKey = useRef('');

	// Boost meter: 1 = full, 0 = spent.
	const boostCharge = useRef(1);
	const boostCooldown = useRef(0);
	// Set when the meter runs dry, so a held Shift cannot re-trigger in pulses
	// as the charge trickles back — you have to let go first.
	const boostLocked = useRef(false);

	// Air time, for the stunt scoring.
	const airTime = useRef(0);

	const applyMassProperties = () => {
		const key = `${config.mass}|${config.centerOfMassY}|${config.rollResistance}|${config.scaleJeep}`;
		if (key === appliedMassKey.current) return;

		const collider = chasisBodyRef.current?.collider(0);
		if (!collider) return;

		// Half extents of the chassis box, matching the CuboidCollider below.
		const hx = 1.395 * config.scaleJeep;
		const hy = 0.805 * config.scaleJeep;
		const hz = 0.595 * config.scaleJeep;

		// Solid box inertia: I = m/12 * (sum of the squares of the other two
		// full dimensions). Scaling the roll axis up resists tipping.
		const k = config.mass / 12;
		const inertia = {
			x: k * ((2 * hy) ** 2 + (2 * hz) ** 2) * config.rollResistance,
			y: k * ((2 * hx) ** 2 + (2 * hz) ** 2),
			z: k * ((2 * hx) ** 2 + (2 * hy) ** 2),
		};

		collider.setMassProperties(
			config.mass,
			{ x: 0, y: config.centerOfMassY * config.scaleJeep, z: 0 },
			inertia,
			{ x: 0, y: 0, z: 0, w: 1 },
		);

		appliedMassKey.current = key;
	};
	
	useFrame((state, delta) => {
		if (!chasisMeshRef.current || !vehicleController.current || !!threeControls) return;

		applyMassProperties();

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
			boost: controls.boost || mobileControls.boost,
			reset: controls.reset || mobileControls.reset,
		}
		const keyboardEngine = Number(merged.forward) - Number(merged.back);
		const joystickEngine = mobileControls.axisY || 0;
		const totalEngine = Math.max(-1, Math.min(1, keyboardEngine + joystickEngine));

		// Boost: only forwards, only while there is charge. Held boost drains the
		// meter; releasing it refills after a short delay.
		if (!merged.boost) boostLocked.current = false;

		const wantsBoost = merged.boost && !boostLocked.current && totalEngine > 0;
		const boosting = wantsBoost && boostCharge.current > 0;

		if (boosting) {
			boostCharge.current = Math.max(0, boostCharge.current - delta / config.boostDuration);
			boostCooldown.current = config.boostRechargeDelay;
			if (boostCharge.current === 0) boostLocked.current = true;
		} else if (boostCooldown.current > 0) {
			boostCooldown.current = Math.max(0, boostCooldown.current - delta);
		} else {
			boostCharge.current = Math.min(1, boostCharge.current + (delta * config.boostRecharge) / config.boostDuration);
		}

		// ── Water ────────────────────────────────────────────────────────────
		const chassisPos = chassisRigidBody.translation();
		const inWater = chassisPos.y < WATER_CONFIG.level + 0.4;

		if (inWater) {
			// Bleed off momentum rather than blocking movement, so water slows
			// you to a wallow instead of stopping you dead.
			const velocity = chassisRigidBody.linvel();
			const drag = WATER_CONFIG.drag ** (delta * 60);
			chassisRigidBody.setLinvel(
				{ x: velocity.x * drag, y: velocity.y * drag, z: velocity.z * drag },
				true
			);
		}

		const boostFactor = boosting ? config.boostMultiplier : 1;
		const waterFactor = inWater ? WATER_CONFIG.powerFactor : 1;
		const engineForce = totalEngine * config.accelerateForce * boostFactor * waterFactor;
		const drivenWheels = config.fourWheelDrive ? [0, 1, 2, 3] : [0, 1];
		[0, 1, 2, 3].forEach((i) => {
			controller.setWheelEngineForce(i, drivenWheels.includes(i) ? engineForce : 0);
		});

		const wheelBrake = Number(merged.brake) * config.brakeForce;
		[0, 1, 2, 3].forEach((i) => controller.setWheelBrake(i, wheelBrake));

		const currentSteering = controller.wheelSteering(0) || 0;
		const keyboardSteer = Number(merged.left) - Number(merged.right);
		const joystickSteer = -(mobileControls.axisX || 0); // Negative because Left is +1
		const steerDirection = Math.max(-1, Math.min(1, keyboardSteer + joystickSteer));

		// Steering falls off with speed: full lock while crawling, a fraction of
		// it at speed, so a hard input cannot snap the back end round.
		const velocity = chassisRigidBody.linvel();
		const speed = Math.hypot(velocity.x, velocity.y, velocity.z);
		const speedRatio = THREE.MathUtils.clamp(speed / config.steerFalloffSpeed, 0, 1);
		const maxSteer = config.steerAngle * THREE.MathUtils.lerp(1, config.steerAtTopSpeed, speedRatio);

		// Framerate-independent smoothing — a flat 0.1 per frame steers twice as
		// fast at 144Hz as it does at 60Hz.
		const steerT = 1.0 - 0.9 ** (delta * 60);
		const steering = THREE.MathUtils.lerp(currentSteering, maxSteer * steerDirection, steerT);
		controller.setWheelSteering(0, steering);
		controller.setWheelSteering(1, steering);

		// 1. Manual Reset (R key): Return to original spawn completely
		if (merged.reset) {
			// Drop in above the terrain rather than the old fixed height.
			const spawnY = getSpawnHeight(position[0], position[2]) + position[1];
			chassisRigidBody.setTranslation(new rapier.Vector3(position[0], spawnY, position[2]), true);
			chassisRigidBody.setRotation(new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), true);
			chassisRigidBody.setLinvel(new rapier.Vector3(0, 0, 0), true);
			chassisRigidBody.setAngvel(new rapier.Vector3(0, 0, 0), true);
		}

		// 2. Auto-Reflip: If the car flips, right it at its CURRENT position
		const currentRotation = chassisRigidBody.rotation();
		const currentQuat = new THREE.Quaternion(currentRotation.x, currentRotation.y, currentRotation.z, currentRotation.w);
		const upVector = new THREE.Vector3(0, 1, 0).applyQuaternion(currentQuat);

		// 2a. Self-righting assist: once tilted past the threshold, nudge the
		// chassis back toward upright instead of letting it commit to a roll.
		// The axis that rotates the body's up vector onto the world's is simply
		// their cross product.
		const tilt = upVector.angleTo(_worldUp);
		if (config.uprightAssist > 0 && tilt > config.uprightThreshold && upVector.y > -0.9) {
			_uprightAxis.crossVectors(upVector, _worldUp);
			if (_uprightAxis.lengthSq() > 1e-6) {
				_uprightAxis.normalize();
				// Scaled by mass so the assist keeps its feel if the mass changes.
				const strength = (tilt - config.uprightThreshold) * config.uprightAssist * config.mass * delta;
				chassisRigidBody.applyTorqueImpulse(
					{ x: _uprightAxis.x * strength, y: _uprightAxis.y * strength, z: _uprightAxis.z * strength },
					true
				);
			}
		}

		if (upVector.y < 0.1 && !merged.reset) {
			const currentPos = chassisRigidBody.translation();
			const groundY = getSpawnHeight(currentPos.x, currentPos.z);
			
			// Get current heading (yaw) so we face the same direction, but remove pitch and roll
			const euler = new THREE.Euler().setFromQuaternion(currentQuat, "YXZ");
			const uprightQuat = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, euler.y, 0, "YXZ"));
			
			// Pop the car up slightly so it falls back down nicely
			chassisRigidBody.setTranslation(new rapier.Vector3(currentPos.x, Math.max(currentPos.y, groundY) + 2.0, currentPos.z), true);
			chassisRigidBody.setRotation(new rapier.Quaternion(uprightQuat.x, uprightQuat.y, uprightQuat.z, uprightQuat.w), true);
			
			// Kill all momentum so it doesn't instantly flip again or shoot off
			chassisRigidBody.setLinvel(new rapier.Vector3(0, 0, 0), true);
			chassisRigidBody.setAngvel(new rapier.Vector3(0, 0, 0), true);
		}

		// ── Stunt scoring ────────────────────────────────────────────────────
		// All four wheels off the ground counts as air. Landing banks the time.
		const airborne = ![0, 1, 2, 3].some((i) => controller.wheelIsInContact(i));

		if (airborne && !inWater) {
			airTime.current += delta;
		} else if (airTime.current > 0) {
			if (airTime.current > 0.7) {
				const points = airTime.current * 150;
				addScore(points);
				GAME_STATE.bestAir = Math.max(GAME_STATE.bestAir, airTime.current);
				announce(airTime.current > 2 ? `HUGE AIR +${Math.round(points)}` : `AIR +${Math.round(points)}`);
			}
			airTime.current = 0;
		}

		// ── HUD state ────────────────────────────────────────────────────────
		const velocityNow = chassisRigidBody.linvel();
		GAME_STATE.speed = Math.hypot(velocityNow.x, velocityNow.y, velocityNow.z) * 3.6;
		GAME_STATE.boost = boostCharge.current;
		GAME_STATE.airTime = airTime.current;
		GAME_STATE.inWater = inWater;

		// Camera follow: uses world position + fixed offset (no rotation follow)
		const bodyPos = chasisMeshRef.current.getWorldPosition(_bodyPosition);
		const cameraPos = _cameraPosition;
		cameraPos.set(
			bodyPos.x + CAMERA_CONFIG.offsetX,
			bodyPos.y + CAMERA_CONFIG.offsetY,
			bodyPos.z + CAMERA_CONFIG.offsetZ
		);
		cameraPos.y = Math.max(cameraPos.y, chassisRigidBody.translation().y + 0.5);
		// Keep the camera above the terrain, or hills swallow it.
		cameraPos.y = Math.max(cameraPos.y, getTerrainHeight(cameraPos.x, cameraPos.z) + 3);
		// Vector3.lerp moves from current value toward target by a blend factor [0..1].
		// Docs: https://threejs.org/docs/#api/en/math/Vector3.lerp
		smoothedCameraPosition.lerp(cameraPos, t);
		state.camera.position.copy(smoothedCameraPosition);


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
			position={spawnPosition}
			rotation={rotation}
			canSleep={false}
			linearDamping={config.linearDamping}
			angularDamping={config.angularDamping}
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
						<Clone object={wheelGltf.scene} castShadow rotation={[0, index % 2 === 0 ? Math.PI : 0, 0]} />
					</group>
				</group>
			))}
		</RigidBody>
	);
};

useGLTF.preload('/car_chassis.glb');
useGLTF.preload('/car_wheel.glb');
