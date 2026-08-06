import { useFrame } from '@react-three/fiber';
import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { PointsNodeMaterial } from 'three/webgpu';
import { attribute, color, float, mix, mod, positionLocal, sin, time, uniform, vec3, vec4 } from 'three/tsl';
import { shadingUniforms } from '@/app/controls/shadingControls';

// Drifting pollen caught in the light.
//
// Replaces drei's <Sparkles>, which builds a raw ShaderMaterial — incompatible
// with the node pipeline, and the source of the "Material ShaderMaterial is not
// compatible" error this project has been logging on every load.
const COUNT = 420;
const FIELD = 70;
const HEIGHT = 22;

export const Motes = () => {
	const pointsRef = useRef<THREE.Points>(null!);
	const cameraXZ = useMemo(() => uniform(new THREE.Vector2()), []);
	const cameraY = useMemo(() => uniform(0), []);

	const geometry = useMemo(() => {
		const positions = new Float32Array(COUNT * 3);
		const seeds = new Float32Array(COUNT);

		for (let i = 0; i < COUNT; i++) {
			positions[i * 3] = (Math.random() - 0.5) * FIELD;
			positions[i * 3 + 1] = Math.random() * HEIGHT;
			positions[i * 3 + 2] = (Math.random() - 0.5) * FIELD;
			seeds[i] = Math.random() * Math.PI * 2;
		}

		const geo = new THREE.BufferGeometry();
		geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
		geo.setAttribute('aSeed', new THREE.BufferAttribute(seeds, 1));
		return geo;
	}, []);

	const material = useMemo(() => {
		const m = new PointsNodeMaterial({
			transparent: true,
			depthWrite: false,
			blending: THREE.AdditiveBlending,
		});

		const seed = float(attribute('aSeed', 'float'));

		// Lazy drift, each mote on its own phase.
		const t = time.mul(0.25).add(seed);
		const drift = vec3(t.sin().mul(1.6), t.mul(0.6).sin().mul(0.9), t.mul(0.8).cos().mul(1.6));

		// Wrap around the camera so the field follows without ever repeating
		// visibly — the same trick the grass uses.
		const wrapped = positionLocal.add(drift).sub(vec3(cameraXZ.x, 0, cameraXZ.y));
		const tiled = vec3(
			mod(wrapped.x.add(FIELD * 0.5), FIELD).sub(FIELD * 0.5).add(cameraXZ.x),
			mod(positionLocal.y.add(drift.y).add(cameraY), HEIGHT),
			mod(wrapped.z.add(FIELD * 0.5), FIELD).sub(FIELD * 0.5).add(cameraXZ.y)
		);

		m.positionNode = tiled;
		m.sizeNode = sin(t.mul(1.7)).mul(0.35).add(1).mul(0.09);

		// Tinted by the sun, so they turn gold at dusk and pale blue at night
		// along with everything else.
		const tint = mix(color('#fff3c4'), shadingUniforms.lightColor, 0.6);
		const twinkle = sin(time.mul(2.3).add(seed)).mul(0.5).add(0.5);
		m.colorNode = vec4(tint, twinkle.mul(0.5).add(0.15));

		return m;
	}, [cameraXZ, cameraY]);

	useFrame((state) => {
		cameraXZ.value.set(state.camera.position.x, state.camera.position.z);
		cameraY.value = state.camera.position.y;
		if (pointsRef.current) {
			pointsRef.current.position.set(0, 0, 0);
		}
	});

	return <points ref={pointsRef} geometry={geometry} material={material} frustumCulled={false} />;
};
