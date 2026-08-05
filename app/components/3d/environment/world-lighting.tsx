import { useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { LIGHTING_CONFIG } from '@/app/controls/lightingControls';
import { SHADING_CONFIG, shadingUniforms } from '@/app/controls/shadingControls';
import { DAY_CYCLE_CONFIG, dayCycle } from '@/app/systems/day-cycles';
import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────────
// Port of folio-2025's `Lighting`.
//
// The sun is placed with spherical coordinates. When the day cycle drives it,
// theta/phi swing around their base angles over the cycle progress, so the sun
// rises, crosses and sets. The light rig follows the camera so the shadow
// frustum stays tight around the player.
//
// `shadingUniforms` are written here every frame — they are what the materials
// actually shade with (see applyFolioShading).
// ─────────────────────────────────────────────────────────────────────────────

const PROGRESS_OFFSET = 9 / 16;

export const WorldLighting = ({ mainLightRef }: { mainLightRef?: React.RefObject<THREE.DirectionalLight> }) => {
	const localMainLightRef = useRef<THREE.DirectionalLight>(null!);
	const activeMainLightRef = mainLightRef || localMainLightRef;
	const ambientLightRef = useRef<THREE.AmbientLight>(null!);

	const { scene } = useThree();
	const helperRef = useRef<THREE.DirectionalLightHelper | null>(null);
	const cameraHelperRef = useRef<THREE.CameraHelper | null>(null);

	// Refs (not memos): these are mutated every frame.
	const sphericalRef = useRef(
		new THREE.Spherical(LIGHTING_CONFIG.radius, LIGHTING_CONFIG.phi, LIGHTING_CONFIG.theta)
	);
	const focusPointRef = useRef(new THREE.Vector3());
	const directionRef = useRef(new THREE.Vector3());
	// Scratch vectors for the texel snapping below.
	const rightRef = useRef(new THREE.Vector3());
	const upRef = useRef(new THREE.Vector3());

	useFrame((state) => {
		if (ambientLightRef.current) {
			ambientLightRef.current.color.set(LIGHTING_CONFIG.ambientColor);
			ambientLightRef.current.intensity = LIGHTING_CONFIG.ambientIntensity;
		}

		const light = activeMainLightRef.current;
		if (!light) return;

		// ── Spherical coordinates ───────────────────────────────────────────
		sphericalRef.current.radius = LIGHTING_CONFIG.radius;

		if (LIGHTING_CONFIG.useDayCycles && DAY_CYCLE_CONFIG.enabled) {
			const angle = -(dayCycle.progress + PROGRESS_OFFSET) * Math.PI * 2;
			sphericalRef.current.theta = LIGHTING_CONFIG.theta + Math.sin(angle) * LIGHTING_CONFIG.thetaAmplitude;
			sphericalRef.current.phi = LIGHTING_CONFIG.phi + Math.cos(angle) * 0.5 * LIGHTING_CONFIG.phiAmplitude;
		} else {
			sphericalRef.current.theta = LIGHTING_CONFIG.theta;
			sphericalRef.current.phi = LIGHTING_CONFIG.phi;
		}

		// Direction used by the shaders (surface → light)
		directionRef.current.setFromSpherical(sphericalRef.current).normalize();
		shadingUniforms.lightDirection.value.copy(directionRef.current);

		// ── Transform ───────────────────────────────────────────────────────
		// Follow the camera, but snap the rig to whole shadow-map texels along
		// the light's own axes. Without this the map resamples on every sub-texel
		// move and shadow edges crawl and sparkle as you drive.
		const texelSize = (LIGHTING_CONFIG.shadowExtent * 2) / LIGHTING_CONFIG.shadowMapSize;

		const forward = directionRef.current;
		const right = rightRef.current.set(0, 1, 0).cross(forward);
		// Degenerate when the sun is straight overhead — fall back to world X.
		if (right.lengthSq() < 1e-6) right.set(1, 0, 0);
		right.normalize();
		const up = upRef.current.crossVectors(forward, right).normalize();

		const focus = focusPointRef.current.set(state.camera.position.x, 0, state.camera.position.z);
		const alongRight = Math.round(focus.dot(right) / texelSize) * texelSize;
		const alongUp = Math.round(focus.dot(up) / texelSize) * texelSize;
		const alongForward = focus.dot(forward);

		focus
			.copy(right)
			.multiplyScalar(alongRight)
			.addScaledVector(up, alongUp)
			.addScaledVector(forward, alongForward);

		light.position.setFromSpherical(sphericalRef.current).add(focusPointRef.current);
		light.target.position.copy(focusPointRef.current);
		light.target.updateMatrixWorld();

		// ── Colour / intensity ──────────────────────────────────────────────
		if (DAY_CYCLE_CONFIG.enabled) {
			shadingUniforms.lightColor.value.copy(dayCycle.properties.lightColor);
			shadingUniforms.lightIntensity.value = dayCycle.properties.lightIntensity;
			shadingUniforms.shadowColor.value.copy(dayCycle.properties.shadowColor);

			light.color.copy(dayCycle.properties.lightColor);
			light.intensity = dayCycle.properties.lightIntensity;
		} else {
			shadingUniforms.lightColor.value.set(LIGHTING_CONFIG.dirColor);
			shadingUniforms.lightIntensity.value = LIGHTING_CONFIG.dirIntensity;
			shadingUniforms.shadowColor.value.set(SHADING_CONFIG.shadowColor);

			light.color.set(LIGHTING_CONFIG.dirColor);
			light.intensity = LIGHTING_CONFIG.dirIntensity;
		}

		// ── Shadow ──────────────────────────────────────────────────────────
		if (light.shadow) {
			const camera = light.shadow.camera;
			camera.top = LIGHTING_CONFIG.shadowExtent;
			camera.right = LIGHTING_CONFIG.shadowExtent;
			camera.bottom = -LIGHTING_CONFIG.shadowExtent;
			camera.left = -LIGHTING_CONFIG.shadowExtent;
			camera.near = LIGHTING_CONFIG.shadowNear;
			camera.far = LIGHTING_CONFIG.shadowNear + LIGHTING_CONFIG.shadowDepth;
			camera.updateProjectionMatrix();

			light.shadow.bias = LIGHTING_CONFIG.shadowBias;
			light.shadow.normalBias = LIGHTING_CONFIG.shadowNormalBias;
			light.shadow.radius = LIGHTING_CONFIG.shadowRadius;

			if (light.shadow.mapSize.width !== LIGHTING_CONFIG.shadowMapSize) {
				light.shadow.mapSize.setScalar(LIGHTING_CONFIG.shadowMapSize);
				light.shadow.map?.dispose();
				light.shadow.map = null;
			}
		}

		// ── Helpers ─────────────────────────────────────────────────────────
		if (LIGHTING_CONFIG.showHelpers) {
			if (!helperRef.current) {
				helperRef.current = new THREE.DirectionalLightHelper(light, 10, '#ff0000');
				scene.add(helperRef.current);
			} else {
				helperRef.current.update();
			}

			if (!cameraHelperRef.current && light.shadow) {
				cameraHelperRef.current = new THREE.CameraHelper(light.shadow.camera);
				scene.add(cameraHelperRef.current);
			} else if (cameraHelperRef.current) {
				cameraHelperRef.current.update();
			}
		} else {
			if (helperRef.current) {
				scene.remove(helperRef.current);
				helperRef.current.dispose();
				helperRef.current = null;
			}
			if (cameraHelperRef.current) {
				scene.remove(cameraHelperRef.current);
				cameraHelperRef.current.dispose();
				cameraHelperRef.current = null;
			}
		}
	});

	return (
		<>
			<ambientLight ref={ambientLightRef} intensity={LIGHTING_CONFIG.ambientIntensity} color={LIGHTING_CONFIG.ambientColor} />
			<directionalLight
				ref={activeMainLightRef}
				castShadow
				shadow-mapSize-width={LIGHTING_CONFIG.shadowMapSize}
				shadow-mapSize-height={LIGHTING_CONFIG.shadowMapSize}
			/>
		</>
	);
};
